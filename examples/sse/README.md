# Server-Sent Events (SSE) Example

This example demonstrates how to use Richie RPC's SSE feature for one-way server-to-client event streaming.

## Overview

Server-Sent Events are ideal for:
- Real-time log streaming
- Live notifications and alerts
- Stock tickers and price updates
- Activity feeds and timelines
- Any scenario where the server pushes updates to clients

## Files

- `contract.ts` - Contract definition with SSE endpoints
- `server.ts` - Server implementation with SSEEmitter
- `client.ts` - Client consuming events with event-based API

## Running the Example

```bash
# Start the server
bun run server.ts

# In another terminal, run the client
bun run client.ts
```

## How It Works

### Contract Definition

SSE endpoints use `type: 'sse'` and define:
- `events` - Object mapping event names to their data schemas

```typescript
const contract = defineContract({
  logs: {
    type: 'sse',
    method: 'GET',
    path: '/logs',
    query: z.object({
      level: z.enum(['info', 'warn', 'error', 'all']).optional(),
    }),
    events: {
      log: z.object({
        level: z.enum(['info', 'warn', 'error']),
        message: z.string(),
        timestamp: z.string(),
      }),
      heartbeat: z.object({
        timestamp: z.string(),
      }),
    },
  },
});
```

### Server Handler

Handlers receive an `emitter` object and `signal` for cleanup:

```typescript
logs: ({ query, emitter, signal }) => {
  const interval = setInterval(() => {
    if (!emitter.isOpen) return;
    emitter.send('log', { level: 'info', message: 'Hello', timestamp: new Date().toISOString() });
  }, 1000);

  // Cleanup when client disconnects
  signal.addEventListener('abort', () => {
    clearInterval(interval);
  });

  // Alternative: return cleanup function
  return () => clearInterval(interval);
}
```

### Client Usage

The client returns an event-based connection:

```typescript
const logs = client.logs({ query: { level: 'error' } });

// Listen for specific event types
logs.on('log', (data) => console.log(data.message));
logs.on('heartbeat', (data) => console.log('ping:', data.timestamp));

// Handle errors
logs.on('error', (err) => console.error(err));

// Check state and close
console.log(logs.state); // 'connecting' | 'open' | 'closed'
logs.close();
```

## Wire Format

SSE uses the standard EventSource format:

```
event: log
data: {"level":"info","message":"Hello","timestamp":"2024-01-01T00:00:00Z"}

event: heartbeat
data: {"timestamp":"2024-01-01T00:00:00Z"}

```

The `Content-Type` header is `text/event-stream`.

## Key Differences from WebSockets

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP | WebSocket |
| Auto-reconnect | Built-in | Manual |
| Binary data | No (text only) | Yes |
| Browser support | Native EventSource | Native WebSocket |
| Use case | Notifications, feeds | Chat, games |

SSE is simpler when you only need server-to-client communication and don't need binary data support.
