# Plan: Add Streaming, SSE, and WebSocket Support

## Summary

Add three realtime communication features to richie-rpc:

1. **Streaming responses** - POST endpoints that stream NDJSON chunks back (e.g., AI typing)
2. **SSE** - GET endpoints that push server events to clients
3. **WebSockets** - Bidirectional realtime with separate `defineWebSocketContract`

**Key decisions:**

- **No backwards compatibility** - all endpoints require explicit `type` field
- Discriminated unions (explicit `type` field) over optional attributes
- NDJSON format for streaming responses
- Separate `defineWebSocketContract()` for WebSockets
- Client validates outgoing messages; client trusts server responses (no validation)
- Server validates incoming client messages with Zod

---

## Files to Create/Modify

| File                                                         | Changes                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [packages/core/index.ts](packages/core/index.ts)             | Add discriminated union endpoint types, type extraction utilities            |
| [packages/core/websocket.ts](packages/core/websocket.ts)     | **NEW** - WebSocket contract types and `defineWebSocketContract`             |
| [packages/client/index.ts](packages/client/index.ts)         | Add streaming/SSE client methods, XHR upload progress, update `createClient` |
| [packages/client/websocket.ts](packages/client/websocket.ts) | **NEW** - WebSocket client with `createWebSocketClient`                      |
| [packages/server/index.ts](packages/server/index.ts)         | Add streaming/SSE response handling in Router                                |
| [packages/server/websocket.ts](packages/server/websocket.ts) | **NEW** - WebSocket router for Bun integration                               |

---

## 1. Core Types (`packages/core/index.ts`)

### Discriminated Union Endpoint Types

```typescript
// Base fields shared by all endpoint types
interface BaseEndpointFields {
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  headers?: z.ZodTypeAny;
}

// Standard HTTP endpoint
export interface StandardEndpointDefinition extends BaseEndpointFields {
  type: 'standard';
  method: HttpMethod;
  body?: z.ZodTypeAny;
  contentType?: ContentType;
  responses: Record<number, z.ZodTypeAny>;
}

// Streaming response endpoint (NDJSON)
export interface StreamingEndpointDefinition extends BaseEndpointFields {
  type: 'streaming';
  method: 'POST';
  body?: z.ZodTypeAny;
  contentType?: ContentType;
  /** Schema for each NDJSON chunk (type inference only, not validated) */
  chunk: z.ZodTypeAny;
  /** Optional final response after stream ends */
  finalResponse?: z.ZodTypeAny;
  /** Error responses */
  errorResponses?: Record<number, z.ZodTypeAny>;
}

// SSE endpoint
export interface SSEEndpointDefinition extends BaseEndpointFields {
  type: 'sse';
  method: 'GET';
  /** Event types: key = event name, value = data schema (type inference only) */
  events: Record<string, z.ZodTypeAny>;
  /** Error responses for connection failures */
  errorResponses?: Record<number, z.ZodTypeAny>;
}

// Union of all endpoint types
export type AnyEndpointDefinition =
  | StandardEndpointDefinition
  | StreamingEndpointDefinition
  | SSEEndpointDefinition;

// Updated Contract type
export type Contract = Record<string, AnyEndpointDefinition>;
```

### Type Extraction Utilities

```typescript
// Extract chunk type from streaming endpoint
export type ExtractChunk<T extends StreamingEndpointDefinition> = T['chunk'] extends z.ZodTypeAny
  ? z.infer<T['chunk']>
  : never;

// Extract SSE event union
export type ExtractSSEEvents<T extends SSEEndpointDefinition> = {
  [K in keyof T['events']]: {
    event: K;
    data: T['events'][K] extends z.ZodTypeAny ? z.infer<T['events'][K]> : never;
    id?: string;
  };
}[keyof T['events']];
```

---

## 2. WebSocket Contract (`packages/core/websocket.ts`)

```typescript
export interface WebSocketMessageDefinition {
  payload: z.ZodTypeAny;
}

export interface WebSocketContractDefinition {
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  headers?: z.ZodTypeAny;

  /** Messages client sends to server (validated with Zod) */
  clientMessages: Record<string, WebSocketMessageDefinition>;

  /** Messages server sends to client (type inference only, NOT validated) */
  serverMessages: Record<string, WebSocketMessageDefinition>;
}

export type WebSocketContract = Record<string, WebSocketContractDefinition>;

// Type extraction
export type ExtractClientMessages<T extends WebSocketContractDefinition> = {
  [K in keyof T['clientMessages']]: {
    type: K;
    payload: z.infer<T['clientMessages'][K]['payload']>;
  };
}[keyof T['clientMessages']];

export type ExtractServerMessages<T extends WebSocketContractDefinition> = {
  [K in keyof T['serverMessages']]: {
    type: K;
    payload: z.infer<T['serverMessages'][K]['payload']>;
  };
}[keyof T['serverMessages']];

export function defineWebSocketContract<T extends WebSocketContract>(contract: T): T {
  return contract;
}
```

---

## 3. Client Implementation

### Streaming Client (`packages/client/index.ts`)

Event-based API (no async iterators - close event indicates stream completion):

```typescript
export interface StreamingResult<T extends StreamingEndpointDefinition> {
  /** Subscribe to chunks */
  on(event: 'chunk', handler: (chunk: ExtractChunk<T>) => void): () => void;
  /** Subscribe to stream close (with optional final response) */
  on(event: 'close', handler: (final?: ExtractFinal<T>) => void): () => void;
  /** Subscribe to errors */
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Abort the stream */
  abort(): void;
  /** Check if aborted */
  readonly aborted: boolean;
}

// Implementation: parse NDJSON stream and emit events
function createStreamingResult<T extends StreamingEndpointDefinition>(
  response: Response,
): StreamingResult<T> {
  const listeners = {
    chunk: new Set<(chunk: any) => void>(),
    close: new Set<(final?: any) => void>(),
    error: new Set<(error: Error) => void>(),
  };
  const controller = new AbortController();

  // Start reading in background
  (async () => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.__final__) {
            listeners.close.forEach((h) => h(parsed.data));
          } else {
            listeners.chunk.forEach((h) => h(parsed));
          }
        }
      }
      listeners.close.forEach((h) => h());
    } catch (err) {
      listeners.error.forEach((h) => h(err as Error));
    }
  })();

  return {
    on(event, handler) {
      listeners[event].add(handler);
      return () => listeners[event].delete(handler);
    },
    abort() {
      controller.abort();
    },
    get aborted() {
      return controller.signal.aborted;
    },
  };
}
```

### SSE Client

Event-based API matching the events defined in contract:

```typescript
export interface SSEConnection<T extends SSEEndpointDefinition> {
  /** Subscribe to a specific event type */
  on<K extends keyof T['events']>(
    event: K,
    handler: (data: z.infer<T['events'][K]>, id?: string) => void,
  ): () => void;
  /** Subscribe to errors */
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Close the connection */
  close(): void;
  /** Current state */
  readonly state: 'connecting' | 'open' | 'closed';
}

// Uses EventSource under the hood
function createSSEConnection<T extends SSEEndpointDefinition>(
  url: string,
  eventNames: string[],
): SSEConnection<T> {
  const eventSource = new EventSource(url);
  const listeners: Record<string, Set<Function>> = {};

  // Register listeners for each event type from contract
  eventNames.forEach((name) => {
    eventSource.addEventListener(name, (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      listeners[name]?.forEach((h) => h(data, (e as MessageEvent).lastEventId));
    });
  });

  eventSource.onerror = (e) => {
    listeners['error']?.forEach((h) => h(new Error('SSE connection error')));
  };

  return {
    on(event, handler) {
      listeners[event] ??= new Set();
      listeners[event].add(handler);
      return () => listeners[event].delete(handler);
    },
    close() {
      eventSource.close();
    },
    get state() {
      return ['connecting', 'open', 'closed'][eventSource.readyState] as any;
    },
  };
}
```

### Upload Progress for Standard Endpoints

For `type: 'standard'` endpoints with `contentType: 'multipart/form-data'`, support upload progress tracking via XMLHttpRequest.

**Types:**

```typescript
export interface UploadProgressEvent {
  loaded: number; // Bytes uploaded
  total: number; // Total bytes
  progress: number; // 0-1 (percentage as decimal)
}

// Add to EndpointRequestOptions
export type EndpointRequestOptions<T extends EndpointDefinition> = {
  // ... existing options
  onUploadProgress?: (event: UploadProgressEvent) => void;
};
```

**Implementation in `makeRequest`:**

Since the client is browser-only, use XMLHttpRequest when `onUploadProgress` is provided:

```typescript
async function makeRequest<T extends EndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>,
): Promise<EndpointResponse<T>> {
  // ... validation and URL building

  // Use XHR for upload progress support
  if (options.onUploadProgress && options.body !== undefined) {
    return makeRequestWithXHR(config, endpoint, options);
  }

  // ... existing fetch implementation
}

function makeRequestWithXHR<T extends EndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>,
): Promise<EndpointResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Build URL (reuse existing logic)
    let path = endpoint.path;
    if (options.params) {
      path = interpolatePath(path, options.params as Record<string, string | number>);
    }
    const url = buildUrl(config.baseUrl, path, options.query);

    xhr.open(endpoint.method, url);

    // Set headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        xhr.setRequestHeader(key, value);
      }
    }
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        xhr.setRequestHeader(key, String(value));
      }
    }

    // Upload progress
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onUploadProgress) {
        options.onUploadProgress({
          loaded: e.loaded,
          total: e.total,
          progress: e.loaded / e.total,
        });
      }
    };

    // Handle abort signal
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.onload = () => {
      let data: unknown;
      const contentType = xhr.getResponseHeader('content-type') || '';

      if (xhr.status === 204) {
        data = {};
      } else if (contentType.includes('application/json')) {
        data = JSON.parse(xhr.responseText);
      } else {
        data = xhr.responseText || {};
      }

      // Validate response if enabled
      if (config.validateResponse !== false) {
        validateResponse(endpoint, xhr.status, data);
      }

      resolve({ status: xhr.status, data } as EndpointResponse<T>);
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    // Send body
    const contentType = endpoint.contentType ?? 'application/json';
    if (contentType === 'multipart/form-data') {
      xhr.send(objectToFormData(options.body as Record<string, unknown>));
    } else {
      xhr.setRequestHeader('content-type', 'application/json');
      xhr.send(JSON.stringify(options.body));
    }
  });
}
```

**React Query Usage Example:**

```typescript
function FileUploadForm() {
  const [progress, setProgress] = useState<number | null>(null);

  const uploadMutation = hooks.uploadDocuments.useMutation({
    onSuccess: () => setProgress(null),
    onError: () => setProgress(null),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProgress(0);

    uploadMutation.mutate({
      body: { documents, category },
      onUploadProgress: (e) => setProgress(e.progress * 100),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... file input */}
      {progress !== null && (
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
          <span>{progress.toFixed(0)}%</span>
        </div>
      )}
      <button type="submit" disabled={uploadMutation.isPending}>
        {uploadMutation.isPending ? `Uploading ${progress?.toFixed(0)}%...` : 'Upload'}
      </button>
    </form>
  );
}
```

---

### WebSocket Client (`packages/client/websocket.ts`)

React-friendly API: object is stable, `connect()` returns disconnect function.

```typescript
export interface TypedWebSocket<T extends WebSocketContractDefinition> {
  /** Connect to WebSocket server, returns disconnect function */
  connect(): () => void;

  /** Send a typed message (validates before sending) */
  send<M extends ExtractClientMessages<T>>(message: M): void;

  /** Subscribe to specific message type, returns unsubscribe function */
  on<K extends keyof T['serverMessages']>(
    type: K,
    handler: (payload: z.infer<T['serverMessages'][K]['payload']>) => void,
  ): () => void;

  /** Subscribe to all messages, returns unsubscribe function */
  onMessage(handler: (message: ExtractServerMessages<T>) => void): () => void;

  /** Subscribe to connection state changes */
  onStateChange(handler: (connected: boolean) => void): () => void;

  /** Subscribe to connection errors (network failures, etc.) */
  onError(handler: (error: Error) => void): () => void;

  /** Current connection state */
  readonly connected: boolean;
}

export function createWebSocketClient<T extends WebSocketContract>(
  contract: T,
  config: { baseUrl: string },
): WebSocketClient<T>;
```

**React integration example:**

```typescript
const ws = wsClient.chat({ params: { roomId: 'room1' } });
const [connected, setConnected] = useState(false);

// Connection lifecycle
useEffect(() => {
  const disconnect = ws.connect();
  return () => disconnect();
}, [ws]);

// Track connection state
useEffect(() => {
  return ws.onStateChange(setConnected);
}, [ws]);

// Subscribe to messages (only when connected)
useEffect(() => {
  if (!connected) return;
  return ws.on('message', (payload) => console.log(payload.text));
}, [connected, ws]);

// Send messages
<Button onClick={() => ws.send({ type: 'sendMessage', payload: { text: 'Hello!' } })} />
```

**Client validates outgoing messages before sending:**

```typescript
send(message) {
  const schema = contract.clientMessages[message.type];
  const result = schema.payload.safeParse(message.payload);
  if (!result.success) throw new ClientValidationError('payload', result.error.issues);
  ws.send(JSON.stringify(message));
}
```

---

## 4. Server Implementation

### Streaming Handler (`packages/server/index.ts`)

```typescript
// Stream emitter for push-based streaming
export interface StreamEmitter<T extends StreamingEndpointDefinition> {
  /** Send a chunk to the client */
  send(chunk: ExtractChunk<T>): void;
  /** Close the stream with optional final response */
  close(final?: ExtractFinal<T>): void;
  /** Check if stream is still open */
  readonly isOpen: boolean;
}

// Handler receives stream emitter (push-based, not generator)
export type StreamingHandler<T extends StreamingEndpointDefinition, C> = (
  input: HandlerInput<T, C> & { stream: StreamEmitter<T> },
) => void | Promise<void>;

// Router creates NDJSON response with push-based emitter
function createStreamingResponse<T extends StreamingEndpointDefinition>(
  handler: (stream: StreamEmitter<T>) => void | Promise<void>,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const stream: StreamEmitter<T> = {
    send(chunk) {
      writer.write(encoder.encode(JSON.stringify(chunk) + '\n'));
    },
    close(final) {
      if (final !== undefined) {
        writer.write(encoder.encode(JSON.stringify({ __final__: true, data: final }) + '\n'));
      }
      writer.close();
    },
    get isOpen() {
      return !writer.closed;
    },
  };

  handler(stream);

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
```

### SSE Handler

```typescript
export interface SSEEmitter<T extends SSEEndpointDefinition> {
  send<K extends keyof T['events']>(
    event: K,
    data: z.infer<T['events'][K]>,
    options?: { id?: string },
  ): void;
  close(): void;
}

export type SSEHandler<T extends SSEEndpointDefinition, C> = (
  input: SSEHandlerInput<T, C>,
) => void | (() => void); // Returns cleanup function
```

### WebSocket Router (`packages/server/websocket.ts`)

```typescript
export class WebSocketRouter<T extends WebSocketContract, C = unknown> {
  constructor(
    contract: T,
    handlers: WebSocketContractHandlers<T, C>,
    options?: { context?: (request: Request) => C | Promise<C> },
  );

  /** Try to match and prepare WebSocket upgrade */
  matchAndPrepareUpgrade(request: Request): UpgradeData | null;

  /** Bun WebSocketHandler config */
  get websocketHandler(): WebSocketHandler<...>;
}

// Server validates incoming client messages:
message(ws, rawMessage) {
  const { type, payload } = JSON.parse(rawMessage);
  const schema = contract.clientMessages[type];
  const result = schema.payload.safeParse(payload);
  if (!result.success) {
    // Call validationError handler or send error message
  }
  handler.message(ws, { type, payload: result.data }, context);
}
```

---

## 5. Bun Integration Example

```typescript
import { createRouter } from '@richie-rpc/server';
import { createWebSocketRouter } from '@richie-rpc/server/websocket';

const httpRouter = createRouter(apiContract, handlers);
const wsRouter = createWebSocketRouter(wsContract, wsHandlers);

Bun.serve({
  port: 3000,

  routes: {
    '/api/*': (req) => httpRouter.handle(req),
  },

  websocket: wsRouter.websocketHandler,

  fetch(request, server) {
    // Try WebSocket upgrade
    const wsMatch = wsRouter.matchAndPrepareUpgrade(request);
    if (wsMatch && request.headers.get('upgrade') === 'websocket') {
      if (server.upgrade(request, { data: wsMatch })) return;
    }
    return new Response('Not Found', { status: 404 });
  },
});
```

---

## 6. Usage Examples

### Standard Endpoint (for reference)

```typescript
// All endpoints now require explicit type
const usersContract = defineContract({
  getUser: {
    type: 'standard',
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ id: z.string(), name: z.string() }),
      [Status.NotFound]: z.object({ error: z.string() }),
    },
  },
});
```

### Streaming (AI Chat)

```typescript
// Contract - chunk schema doesn't need 'done' field, close event indicates completion
const aiContract = defineContract({
  generateText: {
    type: 'streaming',
    method: 'POST',
    path: '/generate',
    body: z.object({ prompt: z.string() }),
    chunk: z.object({ text: z.string() }),
    finalResponse: z.object({ totalTokens: z.number() }),
  },
});

// Client - event-based API
const stream = await client.generateText({ body: { prompt: 'Hello' } });

stream.on('chunk', (chunk) => {
  process.stdout.write(chunk.text);
});

stream.on('close', (final) => {
  if (final) {
    console.log(`\nTotal tokens: ${final.totalTokens}`);
  }
  console.log('Stream complete');
});

stream.on('error', (err) => {
  console.error('Stream error:', err.message);
});

// Server - push-based API with stream.send() / stream.close()
generateText: async ({ body, stream }) => {
  try {
    const words = ['Hello', ' ', 'world', '!'];

    for (const word of words) {
      stream.send({ text: word });
      await delay(100);
    }

    stream.close({ totalTokens: words.length });
  } catch (err) {
    // Stream errors are handled by the router
    console.error('Generation error:', err);
  }
},
```

### SSE (Read-Only Chat - Broadcast to Multiple Clients)

```typescript
// Contract
const contract = defineContract({
  chatStream: {
    type: 'sse',
    method: 'GET',
    path: '/chat/:roomId/stream',
    params: z.object({ roomId: z.string() }),
    events: {
      message: z.object({ userId: z.string(), text: z.string(), timestamp: z.string() }),
      userJoined: z.object({ userId: z.string() }),
      userLeft: z.object({ userId: z.string() }),
      heartbeat: z.object({ timestamp: z.string() }),
    },
  },
});

// Client - event-based API matching contract event names
const conn = client.chatStream({ params: { roomId: 'general' } });

conn.on('message', (data) => {
  console.log(`[${data.timestamp}] ${data.userId}: ${data.text}`);
});

conn.on('userJoined', (data) => {
  console.log(`${data.userId} joined the chat`);
});

conn.on('userLeft', (data) => {
  console.log(`${data.userId} left the chat`);
});

conn.on('error', (err) => {
  console.error('SSE error:', err.message);
});

// Clean up when done
// conn.close();

// ============================================
// Server - Broadcasting to Multiple Clients
// ============================================

// Simple in-memory room manager (use Redis pub/sub for multi-server)
class RoomManager {
  private rooms = new Map<string, Set<SSEEmitter>>();

  join(roomId: string, emitter: SSEEmitter) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(emitter);
  }

  leave(roomId: string, emitter: SSEEmitter) {
    this.rooms.get(roomId)?.delete(emitter);
    if (this.rooms.get(roomId)?.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  broadcast<K extends string>(roomId: string, event: K, data: any) {
    this.rooms.get(roomId)?.forEach((emitter) => {
      emitter.send(event, data);
    });
  }

  getClientCount(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }
}

const roomManager = new RoomManager();

// Handler
chatStream: ({ params, emitter, signal }) => {
  const { roomId } = params;

  // Join room
  roomManager.join(roomId, emitter);

  // Notify others that someone joined
  roomManager.broadcast(roomId, 'userJoined', { userId: 'anonymous' });

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    emitter.send('heartbeat', { timestamp: new Date().toISOString() });
  }, 30000);

  // Cleanup when client disconnects
  return () => {
    clearInterval(heartbeat);
    roomManager.leave(roomId, emitter);
    roomManager.broadcast(roomId, 'userLeft', { userId: 'anonymous' });
  };
},

// Separate endpoint to POST messages (standard endpoint)
// This broadcasts to all connected SSE clients
sendMessage: async ({ params, body, context }) => {
  const { roomId } = params;
  const { text } = body;

  const message = {
    userId: context.user.id,
    text,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to all connected clients via SSE
  roomManager.broadcast(roomId, 'message', message);

  // Optionally persist to database
  await db.messages.create({ roomId, ...message });

  return { status: Status.Created, body: message };
},
```

### WebSocket (Chat)

```typescript
// Contract
const wsContract = defineWebSocketContract({
  chat: {
    path: '/ws/chat/:roomId',
    params: z.object({ roomId: z.string() }),
    clientMessages: {
      sendMessage: { payload: z.object({ text: z.string() }) },
      typing: { payload: z.object({ isTyping: z.boolean() }) },
    },
    serverMessages: {
      message: { payload: z.object({ userId: z.string(), text: z.string() }) },
      userTyping: { payload: z.object({ userId: z.string(), isTyping: z.boolean() }) },
      error: { payload: z.object({ code: z.string(), message: z.string() }) },
    },
  },
});

// Client (React-friendly)
const ws = wsClient.chat({ params: { roomId: 'room1' } });

// In React component:
const [connected, setConnected] = useState(false);
const [error, setError] = useState<string | null>(null);

// Connection lifecycle
useEffect(() => {
  const disconnect = ws.connect();
  return () => disconnect();
}, [ws]);

// Track connection state
useEffect(() => {
  return ws.onStateChange(setConnected);
}, [ws]);

// Subscribe to messages (only when connected)
useEffect(() => {
  if (!connected) return;
  return ws.on('message', (payload) => {
    console.log(`${payload.userId}: ${payload.text}`);
  });
}, [connected, ws]);

// Handle server-sent errors
useEffect(() => {
  if (!connected) return;
  return ws.on('error', (payload) => {
    setError(`${payload.code}: ${payload.message}`);
  });
}, [connected, ws]);

// Handle connection errors
useEffect(() => {
  return ws.onError((err) => {
    console.error('WebSocket error:', err.message);
    setError('Connection failed');
  });
}, [ws]);

// Send on button click (validates before sending)
const handleSend = (text: string) => {
  try {
    ws.send({ type: 'sendMessage', payload: { text } });
  } catch (err) {
    if (err instanceof ClientValidationError) {
      console.error('Invalid message:', err.issues);
    }
  }
};

// Server
chat: {
  open(ws, ctx) {
    ws.subscribe(`room:${ws.data.params.roomId}`);
    console.log(`User ${ctx.user.id} joined room ${ws.data.params.roomId}`);
  },

  message(ws, msg, ctx) {
    if (msg.type === 'sendMessage') {
      // Broadcast to room
      ws.publish(`room:${ws.data.params.roomId}`, {
        type: 'message',
        payload: { userId: ctx.user.id, text: msg.payload.text },
      });
    } else if (msg.type === 'typing') {
      ws.publish(`room:${ws.data.params.roomId}`, {
        type: 'userTyping',
        payload: { userId: ctx.user.id, isTyping: msg.payload.isTyping },
      });
    }
  },

  close(ws, ctx) {
    console.log(`User ${ctx.user.id} left room ${ws.data.params.roomId}`);
  },

  // Handle validation errors from invalid client messages
  validationError(ws, error, ctx) {
    ws.send({
      type: 'error',
      payload: { code: 'VALIDATION_ERROR', message: error.message },
    });
  },
},
```

---

## Implementation Order

1. **Core types** - Replace EndpointDefinition with discriminated unions, add `UploadProgressEvent`
2. **Core websocket.ts** - WebSocket contract types
3. **Server streaming/SSE** - Push-based handlers with `stream.send()`/`emitter.send()`, response creation
4. **Server websocket.ts** - WebSocket router for Bun
5. **Client upload progress** - Add `onUploadProgress` to request options, XHR-based upload with progress
6. **Client streaming** - NDJSON parser, event-based API with `.on('chunk'/'close'/'error')`
7. **Client SSE** - EventSource wrapper, event-based API with `.on(eventName)`
8. **Client websocket.ts** - Typed WebSocket client with `.on()`, `.onError()`, `.onStateChange()`
9. **Demo endpoints** - Add examples for each feature (including file upload with progress)
10. **Tests** - Unit and integration tests
