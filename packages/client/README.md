# @richie-rpc/client

Type-safe fetch client for Richie RPC contracts.

## Installation

```bash
bun add @richie-rpc/client @richie-rpc/core zod@^4
```

## Usage

### Creating a Client

```typescript
import { createClient } from '@richie-rpc/client';
import { contract } from './contract';

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer token123',
  },
});
```

### Client with basePath

The `baseUrl` supports both absolute and relative URLs:

```typescript
// Absolute URL with path prefix
const client = createClient(contract, {
  baseUrl: 'https://api.example.com/api',
});

// Relative URL with path prefix (browser-friendly)
const client = createClient(contract, {
  baseUrl: '/api', // Resolves to current origin + /api
});

// Just the path (same origin)
const client = createClient(contract, {
  baseUrl: '/', // Resolves to current origin
});
```

**How it works:**

- **Absolute URLs** (`http://...` or `https://...`): Used as-is
- **Relative URLs** (starting with `/`): Automatically resolved using `window.location.origin` in browsers, or `http://localhost` in non-browser environments

**Example:** In a browser at `https://example.com`, if your contract defines `/users`:

- With `baseUrl: '/api'` → actual URL is `https://example.com/api/users`
- With `baseUrl: '/'` → actual URL is `https://example.com/users`

### Making Requests

The client provides fully typed methods for each endpoint in your contract:

```typescript
// GET request with path parameters
const user = await client.getUser({
  params: { id: '123' },
});
// user is typed based on the response schema

// POST request with body
const newUser = await client.createUser({
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});

// Request with query parameters
const users = await client.listUsers({
  query: {
    limit: '10',
    offset: '0',
  },
});

// Request with custom headers
const data = await client.getData({
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

### File Uploads (multipart/form-data)

Upload files with full type safety. Files can be nested anywhere in the request body:

```typescript
// Contract defines the file upload endpoint
// (see @richie-rpc/core for defining contentType: 'multipart/form-data')

// Client usage - just pass File objects in the body
const file1 = new File(['content'], 'report.pdf', { type: 'application/pdf' });
const file2 = new File(['data'], 'data.csv', { type: 'text/csv' });

const response = await client.uploadDocuments({
  body: {
    documents: [
      { file: file1, name: 'Q4 Report', tags: ['quarterly', 'finance'] },
      { file: file2, name: 'Sales Data' },
    ],
    category: 'reports',
  },
});

if (response.status === 201) {
  console.log(`Uploaded ${response.data.uploadedCount} files`);
}
```

The client automatically:

- Detects `multipart/form-data` content type from the contract
- Serializes nested structures with File objects to FormData
- Sets the correct `Content-Type` header with boundary

### Canceling Requests

You can cancel in-flight requests using `AbortController`:

```typescript
const controller = new AbortController();

// Pass the abort signal to the request
const promise = client.getUser({
  params: { id: '123' },
  abortSignal: controller.signal,
});

// Cancel the request
controller.abort();

try {
  await promise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

**React Example:**

```typescript
useEffect(() => {
  const controller = new AbortController();

  client
    .getConversation({
      params: { projectId, sessionId },
      abortSignal: controller.signal,
    })
    .then((response) => {
      if (response.status === 200) {
        setData(response.data);
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        console.error('Request failed:', error);
      }
    });

  // Cleanup: abort request if component unmounts
  return () => controller.abort();
}, [projectId, sessionId]);
```

**Timeout Example:**

```typescript
const controller = new AbortController();

// Abort after 5 seconds
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await client.getData({
    abortSignal: controller.signal,
  });
  clearTimeout(timeoutId);
  console.log(response.data);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request timed out');
  }
}
```

## Streaming Responses

For streaming endpoints, the client returns an event-based result:

```typescript
const contract = defineContract({
  generateText: {
    type: 'streaming',
    method: 'POST',
    path: '/generate',
    body: z.object({ prompt: z.string() }),
    chunk: z.object({ text: z.string() }),
    finalResponse: z.object({ totalTokens: z.number() }),
  },
});

const client = createClient(contract, { baseUrl: 'http://localhost:3000' });

const result = client.generateText({ body: { prompt: 'Hello world' } });

// Listen for chunks
result.on('chunk', (chunk) => {
  process.stdout.write(chunk.text);
});

// Listen for stream completion
result.on('close', (final) => {
  if (final) {
    console.log(`\nTotal tokens: ${final.totalTokens}`);
  }
});

// Handle errors
result.on('error', (error) => {
  console.error('Stream error:', error.message);
});

// Abort if needed
result.abort();
```

### StreamingResult Interface

- `on('chunk', handler)` - Subscribe to chunks
- `on('close', handler)` - Subscribe to stream close (with optional final response)
- `on('error', handler)` - Subscribe to errors
- `abort()` - Abort the stream
- `aborted` - Check if the stream was aborted

## Server-Sent Events (SSE)

For SSE endpoints, the client returns an event-based connection:

```typescript
const contract = defineContract({
  notifications: {
    type: 'sse',
    method: 'GET',
    path: '/notifications',
    events: {
      message: z.object({ text: z.string(), timestamp: z.string() }),
      heartbeat: z.object({ timestamp: z.string() }),
    },
  },
});

const client = createClient(contract, { baseUrl: 'http://localhost:3000' });

const conn = client.notifications();

// Listen for specific event types
conn.on('message', (data) => {
  console.log(`Message: ${data.text} at ${data.timestamp}`);
});

conn.on('heartbeat', (data) => {
  console.log('Heartbeat:', data.timestamp);
});

// Handle connection errors
conn.on('error', (error) => {
  console.error('SSE error:', error.message);
});

// Close when done
conn.close();

// Check connection state
console.log('State:', conn.state); // 'connecting' | 'open' | 'closed'
```

### SSEConnection Interface

- `on(event, handler)` - Subscribe to a specific event type
- `on('error', handler)` - Subscribe to connection errors
- `close()` - Close the connection
- `state` - Current connection state

## WebSocket Client

For bidirectional real-time communication, use `createWebSocketClient`:

```typescript
import { createWebSocketClient } from '@richie-rpc/client';
import { defineWebSocketContract } from '@richie-rpc/core';

const wsContract = defineWebSocketContract({
  chat: {
    path: '/ws/chat/:roomId',
    params: z.object({ roomId: z.string() }),
    clientMessages: {
      sendMessage: { payload: z.object({ text: z.string() }) },
    },
    serverMessages: {
      message: { payload: z.object({ userId: z.string(), text: z.string() }) },
      error: { payload: z.object({ code: z.string(), message: z.string() }) },
    },
  },
});

const wsClient = createWebSocketClient(wsContract, {
  baseUrl: 'ws://localhost:3000',
});

// Get a typed WebSocket instance
const chat = wsClient.chat({ params: { roomId: 'general' } });

// Connect (returns disconnect function)
const disconnect = chat.connect();

// Track connection state
chat.onStateChange((connected) => {
  console.log('Connected:', connected);
});

// Listen for specific message types
chat.on('message', (payload) => {
  console.log(`${payload.userId}: ${payload.text}`);
});

chat.on('error', (payload) => {
  console.error(`Error ${payload.code}: ${payload.message}`);
});

// Listen for all messages
chat.onMessage((message) => {
  console.log('Received:', message.type, message.payload);
});

// Handle connection errors
chat.onError((error) => {
  console.error('Connection error:', error.message);
});

// Send messages (validates before sending)
chat.send('sendMessage', { text: 'Hello!' });

// Disconnect when done
disconnect();
```

### TypedWebSocket Interface

- `connect()` - Connect to the WebSocket server, returns disconnect function
- `send(type, payload)` - Send a typed message (validates before sending)
- `on(type, handler)` - Subscribe to a specific message type
- `onMessage(handler)` - Subscribe to all messages
- `onStateChange(handler)` - Track connection state changes
- `onError(handler)` - Handle connection errors
- `connected` - Check current connection state

### React Integration Example

```typescript
function ChatRoom({ roomId }: { roomId: string }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const chat = useMemo(
    () => wsClient.chat({ params: { roomId } }),
    [roomId]
  );

  // Connection lifecycle
  useEffect(() => {
    const disconnect = chat.connect();
    return () => disconnect();
  }, [chat]);

  // Track connection state
  useEffect(() => {
    return chat.onStateChange(setConnected);
  }, [chat]);

  // Subscribe to messages (only when connected)
  useEffect(() => {
    if (!connected) return;
    return chat.on('message', (payload) => {
      setMessages((prev) => [...prev, payload]);
    });
  }, [connected, chat]);

  const handleSend = (text: string) => {
    chat.send('sendMessage', { text });
  };

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.userId}: {msg.text}</div>
      ))}
      <button onClick={() => handleSend('Hello!')}>Send</button>
    </div>
  );
}
```

## Features

- ✅ Full type safety based on contract
- ✅ Automatic path parameter interpolation
- ✅ Query parameter encoding
- ✅ BasePath support in baseUrl
- ✅ HTTP Streaming with event-based API
- ✅ Server-Sent Events (SSE) client
- ✅ WebSocket client with typed messages
- ✅ Request validation before sending
- ✅ Response validation after receiving
- ✅ Detailed error information
- ✅ Support for all HTTP methods
- ✅ Custom headers per request
- ✅ Request cancellation with AbortController
- ✅ File uploads with `multipart/form-data`
- ✅ Nested file structures in request bodies

## Configuration

### ClientConfig Options

```typescript
interface ClientConfig {
  baseUrl: string; // Base URL for all requests
  headers?: Record<string, string>; // Default headers
  validateRequest?: boolean; // Validate before sending (default: true)
  validateResponse?: boolean; // Validate after receiving (default: true)
}
```

## Response Format

Responses include both the status code and data:

```typescript
const response = await client.getUser({ params: { id: '123' } });

console.log(response.status); // 200, 404, etc.
console.log(response.data); // Typed response body
```

## Error Handling

The client throws typed errors for different scenarios:

### ClientValidationError

Thrown when request data fails validation:

```typescript
try {
  await client.createUser({
    body: { email: 'invalid-email' },
  });
} catch (error) {
  if (error instanceof ClientValidationError) {
    console.log(error.field); // 'body'
    console.log(error.issues); // Zod validation issues
  }
}
```

### HTTPError

Thrown for unexpected HTTP status codes:

```typescript
try {
  await client.getUser({ params: { id: '999' } });
} catch (error) {
  if (error instanceof HTTPError) {
    console.log(error.status); // 404
    console.log(error.statusText); // 'Not Found'
    console.log(error.body); // Response body
  }
}
```

## Type Safety

All client methods are fully typed based on your contract:

```typescript
// ✅ Type-safe: required fields
await client.createUser({
  body: { name: 'John', email: 'john@example.com' },
});

// ❌ Type error: missing required field
await client.createUser({
  body: { name: 'John' },
});

// ✅ Type-safe: response data
const user = await client.getUser({ params: { id: '123' } });
console.log(user.data.name); // string

// ❌ Type error: invalid property
console.log(user.data.invalid);
```

## Request Options

Each client method accepts an options object with the following fields (based on the endpoint definition):

- `params`: Path parameters (if endpoint has params schema)
- `query`: Query parameters (if endpoint has query schema)
- `headers`: Custom headers (if endpoint has headers schema)
- `body`: Request body (if endpoint has body schema)
- `abortSignal`: AbortSignal for request cancellation (optional, always available)

Only the fields defined in the contract are available and typed (except `abortSignal`, which is always available).

## Validation

By default, both request and response data are validated:

- **Request validation**: Ensures data conforms to schema before sending
- **Response validation**: Ensures server response matches expected schema

You can disable validation:

```typescript
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  validateRequest: false, // Skip request validation
  validateResponse: false, // Skip response validation
});
```

## Links

- **npm:** https://www.npmjs.com/package/@richie-rpc/client
- **Repository:** https://github.com/ricsam/richie-rpc

## License

MIT
