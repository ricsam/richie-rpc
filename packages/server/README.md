# @richie-rpc/server

Server implementation package for Richie RPC with Bun.serve compatibility.

## Installation

```bash
bun add @richie-rpc/server @richie-rpc/core zod@^4
```

## Usage

### Creating a Router

```typescript
import { createRouter, Status } from '@richie-rpc/server';
import { contract } from './contract';

const router = createRouter(contract, {
  getUser: async ({ params }) => {
    // params is fully typed based on the contract
    const user = await db.getUser(params.id);

    if (!user) {
      return { status: Status.NotFound, body: { error: 'User not found' } };
    }

    return { status: Status.OK, body: user };
  },

  createUser: async ({ body }) => {
    // body is fully typed and already validated
    const user = await db.createUser(body);
    return { status: Status.Created, body: user };
  },
});
```

### Router with basePath

You can serve your API under a path prefix (e.g., `/api`) using the `basePath` option:

```typescript
const router = createRouter(contract, handlers, {
  basePath: '/api',
});

Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);

    // Route all /api/* requests to the router
    if (url.pathname.startsWith('/api/')) {
      return router.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
});
```

The router will automatically strip the basePath prefix before matching routes. For example, if your contract defines a route at `/users`, and you set `basePath: '/api'`, the actual URL will be `/api/users`.

### Using with Bun.serve

```typescript
Bun.serve({
  port: 3000,
  fetch: router.fetch,
});
```

Or with custom routing:

```typescript
Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return router.handle(request);
    }

    return new Response('Not Found', { status: 404 });
  },
});
```

## Features

- ✅ Automatic request validation (params, query, headers, body)
- ✅ Automatic response validation
- ✅ Type-safe handler inputs
- ✅ Type-safe status codes with `Status` const object
- ✅ HTTP Streaming with `StreamEmitter`
- ✅ Server-Sent Events with `SSEEmitter`
- ✅ WebSocket router with typed messages and custom data validation
- ✅ Path parameter matching
- ✅ Query parameter parsing
- ✅ JSON body parsing
- ✅ File uploads with `multipart/form-data`
- ✅ Nested file structures in request bodies
- ✅ BasePath support for serving APIs under path prefixes
- ✅ Detailed validation errors
- ✅ 404 handling for unknown routes
- ✅ Error handling and reporting

## Handler Input

Each handler receives a typed input object with:

```typescript
{
  params: Record<string, string>,  // Path parameters
  query: Record<string, any>,      // Query parameters
  headers: Record<string, string>, // Request headers
  body: any,                       // Request body
  request: Request                 // Original Request object
}
```

## Handler Response

Each handler must return a response object with:

```typescript
{
  status: number,              // HTTP status code (must match contract)
  body: any,                   // Response body (must match schema)
  headers?: Record<string, string>  // Optional custom headers
}
```

### Using Status Codes

Use the `Status` const object for type-safe status codes:

```typescript
import { Status } from '@richie-rpc/server';

return { status: Status.OK, body: user }; // 200
return { status: Status.Created, body: newUser }; // 201
return { status: Status.NoContent, body: {} }; // 204
return { status: Status.BadRequest, body: error }; // 400
return { status: Status.NotFound, body: error }; // 404
```

Available status codes in `Status` object:

- **Success**: `OK` (200), `Created` (201), `Accepted` (202), `NoContent` (204)
- **Redirection**: `MovedPermanently` (301), `Found` (302), `NotModified` (304)
- **Client Errors**: `BadRequest` (400), `Unauthorized` (401), `Forbidden` (403), `NotFound` (404), `MethodNotAllowed` (405), `Conflict` (409), `UnprocessableEntity` (422), `TooManyRequests` (429)
- **Server Errors**: `InternalServerError` (500), `NotImplemented` (501), `BadGateway` (502), `ServiceUnavailable` (503), `GatewayTimeout` (504)

**Using custom status codes:**

For status codes not in the `Status` object:

```typescript
// 1. Define in contract (no 'as const' needed)
responses: {
  418: z.object({ message: z.string() })
}

// 2. Return in handler (with 'as const')
return { status: 418 as const, body: { message: "I'm a teapot" } };
```

Full example:

```typescript
const contract = defineContract({
  teapot: {
    method: 'GET',
    path: '/teapot',
    responses: {
      418: z.object({ message: z.string(), isTeapot: z.boolean() }),
    },
  },
});

const router = createRouter(contract, {
  teapot: async () => {
    return {
      status: 418 as const,
      body: { message: "I'm a teapot", isTeapot: true },
    };
  },
});
```

## Handling File Uploads

The server automatically handles `multipart/form-data` requests when the contract specifies `contentType: 'multipart/form-data'`. File objects are fully reconstructed and passed to your handler:

```typescript
const contract = defineContract({
  uploadDocuments: {
    method: 'POST',
    path: '/upload',
    contentType: 'multipart/form-data',
    body: z.object({
      documents: z.array(
        z.object({
          file: z.instanceof(File),
          name: z.string(),
          tags: z.array(z.string()).optional(),
        }),
      ),
      category: z.string(),
    }),
    responses: {
      [Status.Created]: z.object({
        uploadedCount: z.number(),
        totalSize: z.number(),
      }),
    },
  },
});

const router = createRouter(contract, {
  uploadDocuments: async ({ body }) => {
    // body.documents is fully typed with File objects
    let totalSize = 0;

    for (const doc of body.documents) {
      // doc.file is a File object
      const buffer = await doc.file.arrayBuffer();
      totalSize += buffer.byteLength;

      console.log(`Processing: ${doc.name} (${doc.file.name})`);
      console.log(`Tags: ${doc.tags?.join(', ') ?? 'none'}`);
    }

    return {
      status: Status.Created,
      body: {
        uploadedCount: body.documents.length,
        totalSize,
      },
    };
  },
});
```

The server automatically:

- Parses `multipart/form-data` requests
- Reconstructs nested structures with File objects
- Validates the body against your Zod schema

## Streaming Responses

For AI-style streaming responses, handlers receive a `stream` object:

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

const router = createRouter(contract, {
  generateText: async ({ body, stream }) => {
    const words = body.prompt.split(' ');

    for (const word of words) {
      if (!stream.isOpen) return; // Client disconnected
      stream.send({ text: word + ' ' });
      await new Promise((r) => setTimeout(r, 100));
    }

    stream.close({ totalTokens: words.length });
  },
});
```

### StreamEmitter Interface

- `send(chunk)` - Send a chunk to the client (NDJSON format)
- `close(finalResponse?)` - Close the stream with optional final response
- `isOpen` - Check if the stream is still open

## Server-Sent Events (SSE)

For server-to-client event streaming, handlers receive an `emitter` object:

```typescript
const contract = defineContract({
  notifications: {
    type: 'sse',
    method: 'GET',
    path: '/notifications',
    events: {
      message: z.object({ text: z.string() }),
      heartbeat: z.object({ timestamp: z.string() }),
    },
  },
});

const router = createRouter(contract, {
  notifications: ({ emitter, signal }) => {
    // Send heartbeats every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!emitter.isOpen) return;
      emitter.send('heartbeat', { timestamp: new Date().toISOString() });
    }, 30000);

    // Cleanup when client disconnects
    signal.addEventListener('abort', () => {
      clearInterval(heartbeatInterval);
    });

    // Optional: return cleanup function
    return () => clearInterval(heartbeatInterval);
  },
});
```

### SSEEmitter Interface

- `send(event, data, options?)` - Send an event with data and optional ID
- `close()` - Close the connection
- `isOpen` - Check if the connection is still open

## WebSocket Router

For bidirectional real-time communication, use `createWebSocketRouter`. The router is generic over the WebSocket type, making it portable across different runtimes (Bun, Node.js with `ws`, Deno, etc.).

```typescript
import { createWebSocketRouter, type UpgradeData } from '@richie-rpc/server';
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

// Define your WebSocket type (Bun example)
type BunWS = Bun.ServerWebSocket<UpgradeData>;

const wsRouter = createWebSocketRouter(
  wsContract,
  {
    chat: {
      open({ ws, params }) {
        // Called when connection opens
        // ws.raw is typed as BunWS, so you get Bun-specific methods
        ws.raw.subscribe(`room:${params.roomId}`);
        console.log('User joined room:', params.roomId);
      },

      message({ ws, message: msg, params }) {
        // Called for each validated client message
        if (msg.type === 'sendMessage') {
          ws.raw.publish(
            `room:${params.roomId}`,
            JSON.stringify({
              type: 'message',
              payload: { userId: 'user1', text: msg.payload.text },
            }),
          );
        }
      },

      close({ params }) {
        // Called when connection closes
        console.log('User left room:', params.roomId);
      },

      validationError({ ws, error }) {
        // Called when client message validation fails
        ws.send('error', { code: 'VALIDATION_ERROR', message: error.message });
      },
    },
  },
  {
    // Pass rawWebSocket for type inference - ws.raw will be typed as BunWS
    rawWebSocket: {} as BunWS,
  },
);
```

### Handler Arguments

All handlers receive a destructured object with:

- `ws` - TypedServerWebSocket for sending typed messages
- `params` - Path parameters (typed from contract)
- `query` - Query parameters (typed from contract)
- `headers` - Request headers (typed from contract)
- `data` - Custom user data (when `dataSchema` is provided)
- `message` - The validated client message (only in `message` handler)

### TypedServerWebSocket Interface

- `send(type, payload)` - Send a typed message to the client
- `close(code?, reason?)` - Close the connection
- `raw` - Access the underlying WebSocket (typed based on `rawWebSocket` option)

### Generic WebSocket Type

The router uses a `GenericWebSocket` interface that any WebSocket implementation can satisfy:

```typescript
type GenericWebSocket = {
  send: (message: string) => void;
  close: (code?: number, reason?: string) => void;
};
```

Use the `rawWebSocket` option to provide type hints for your specific WebSocket implementation. This enables full type inference for `ws.raw` in your handlers.

### Using Custom Data with dataSchema

You can pass custom data during WebSocket upgrade and have it validated:

```typescript
const wsRouter = createWebSocketRouter(
  wsContract,
  {
    chat: {
      message({ ws, message, data }) {
        // data is typed and validated
        console.log('User ID:', data.userId);
      },
    },
  },
  {
    rawWebSocket: {} as BunWS,
    dataSchema: z.object({
      userId: z.string(),
      sessionId: z.string(),
    }),
  },
);
```

### Integrating with Bun.serve

```typescript
Bun.serve<UpgradeData>({
  port: 3000,

  websocket: {
    open(ws) {
      wsRouter.websocketHandler.open({ ws, upgradeData: ws.data });
    },
    message(ws, rawMessage) {
      wsRouter.websocketHandler.message({ ws, rawMessage, upgradeData: ws.data });
    },
    close(ws, code, reason) {
      wsRouter.websocketHandler.close({ ws, code, reason, upgradeData: ws.data });
    },
    drain(ws) {
      wsRouter.websocketHandler.drain({ ws, upgradeData: ws.data });
    },
  },

  async fetch(request, server) {
    // Try WebSocket upgrade
    const upgradeData = await wsRouter.matchAndPrepareUpgrade(request);
    if (upgradeData && request.headers.get('upgrade') === 'websocket') {
      if (server.upgrade(request, { data: upgradeData })) return;
    }

    // Handle regular HTTP requests
    return router.fetch(request);
  },
});
```

### With Custom Data

When using `dataSchema`, pass the data to each handler:

```typescript
Bun.serve<UpgradeData>({
  websocket: {
    open(ws) {
      wsRouter.websocketHandler.open({
        ws,
        upgradeData: ws.data,
        data: { userId: 'user123', sessionId: 'sess456' },
      });
    },
    message(ws, rawMessage) {
      wsRouter.websocketHandler.message({
        ws,
        rawMessage,
        upgradeData: ws.data,
        data: { userId: 'user123', sessionId: 'sess456' },
      });
    },
    // ... other handlers also receive data
  },

  async fetch(request, server) {
    const upgradeData = await wsRouter.matchAndPrepareUpgrade(request);
    if (upgradeData && request.headers.get('upgrade') === 'websocket') {
      server.upgrade(request, { data: upgradeData });
      return;
    }
    return new Response('Not found', { status: 404 });
  },
});
```

## Error Handling

The router throws specific error classes that you can catch and handle. These errors are thrown before handlers are called, so you should wrap your router calls in try-catch blocks.

### Error Classes

#### `ValidationError`

Thrown when request or response validation fails. Contains detailed Zod validation issues.

**Properties:**

- `field: string` - The field that failed validation (`"params"`, `"query"`, `"headers"`, `"body"`, or `"response[status]"`)
- `issues: z.ZodIssue[]` - Array of Zod validation issues with detailed error information
- `message: string` - Error message

**When thrown:**

- Invalid path parameters (params)
- Invalid query parameters (query)
- Invalid request headers (headers)
- Invalid request body (body)
- Invalid response body returned from handler (response validation)

**Example:**

```typescript
import { createRouter, ValidationError, RouteNotFoundError } from '@richie-rpc/server';

const router = createRouter(contract, handlers);

Bun.serve({
  port: 3000,
  async fetch(request) {
    try {
      return await router.handle(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        // Handle validation errors
        return Response.json(
          {
            error: 'Validation Error',
            field: error.field,
            issues: error.issues,
          },
          { status: 400 },
        );
      }

      if (error instanceof RouteNotFoundError) {
        // Handle route not found
        return Response.json(
          {
            error: 'Not Found',
            message: `Route ${error.method} ${error.path} not found`,
          },
          { status: 404 },
        );
      }

      // Handle unexpected errors
      console.error('Unexpected error:', error);
      return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
});
```

#### `RouteNotFoundError`

Thrown when no matching route is found for the request.

**Properties:**

- `path: string` - The requested path
- `method: string` - The HTTP method (GET, POST, etc.)

**When thrown:**

- No endpoint in the contract matches the request method and path

**Example:**

```typescript
try {
  return await router.handle(request);
} catch (error) {
  if (error instanceof RouteNotFoundError) {
    return Response.json(
      {
        error: 'Not Found',
        message: `Cannot ${error.method} ${error.path}`,
      },
      { status: 404 },
    );
  }
  throw error; // Re-throw other errors
}
```

### Complete Error Handling Example

```typescript
import { createRouter, ValidationError, RouteNotFoundError, Status } from '@richie-rpc/server';

const router = createRouter(contract, handlers);

Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      try {
        return await router.handle(request);
      } catch (error) {
        if (error instanceof ValidationError) {
          // Format validation errors for client
          return Response.json(
            {
              error: 'Validation Error',
              field: error.field,
              issues: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
              })),
            },
            { status: 400 },
          );
        }

        if (error instanceof RouteNotFoundError) {
          return Response.json(
            {
              error: 'Not Found',
              message: `Route ${error.method} ${error.path} not found`,
            },
            { status: 404 },
          );
        }

        // Log unexpected errors
        console.error('Unexpected error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    // Handle other routes
    return new Response('Not Found', { status: 404 });
  },
});
```

### Handler-Level Errors

Errors thrown inside handlers are not automatically caught by the router. You should handle them within your handlers:

```typescript
const router = createRouter(contract, {
  getUser: async ({ params }) => {
    try {
      const user = await db.getUser(params.id);
      if (!user) {
        return { status: Status.NotFound, body: { error: 'User not found' } };
      }
      return { status: Status.OK, body: user };
    } catch (error) {
      // Handle database errors, etc.
      console.error('Database error:', error);
      return {
        status: Status.InternalServerError,
        body: { error: 'Failed to fetch user' },
      };
    }
  },
});
```

## Validation

Both request and response data are validated against the contract schemas:

- Request validation happens before calling the handler
- Response validation happens before sending to the client
- Validation errors return detailed Zod error information

## Links

- **npm:** https://www.npmjs.com/package/@richie-rpc/server
- **Repository:** https://github.com/ricsam/richie-rpc

## License

MIT
