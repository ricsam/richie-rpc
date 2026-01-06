# WebSocket Example

This example demonstrates how to use Richie RPC's WebSocket feature for bidirectional real-time communication, including a complete chat room implementation.

## Overview

WebSockets are ideal for:
- Real-time chat applications
- Multiplayer games
- Collaborative editing
- Live dashboards with bidirectional communication
- Any scenario requiring low-latency, bidirectional messaging

## Files

- `contract.ts` - WebSocket contract definition with client/server messages
- `server.ts` - Server implementation with room management and pub/sub
- `client.ts` - CLI client demonstrating the WebSocket API
- `client-react.tsx` - React integration example with custom hooks

## Running the Example

```bash
# Start the server
bun run server.ts

# In another terminal, run the CLI client
bun run client.ts

# Or use the React component in your app
```

## How It Works

### Contract Definition

WebSocket contracts use `defineWebSocketContract` with:
- `path` - WebSocket endpoint path with optional parameters
- `clientMessages` - Messages the client can send
- `serverMessages` - Messages the server can send

```typescript
import { defineWebSocketContract } from '@richie-rpc/core';

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
      typing: { payload: z.object({ userId: z.string(), isTyping: z.boolean() }) },
    },
  },
});
```

### Server Handler

Server handlers have lifecycle methods:

```typescript
import { createWebSocketRouter } from '@richie-rpc/server';

const wsRouter = createWebSocketRouter(wsContract, {
  chat: {
    open(ws) {
      // Called when connection opens
      ws.subscribe(`room:${ws.data.params.roomId}`);
    },
    message(ws, msg) {
      // Called for each validated client message
      if (msg.type === 'sendMessage') {
        ws.publish(`room:${ws.data.params.roomId}`, 'message', {
          userId: 'user1',
          text: msg.payload.text,
        });
      }
    },
    close(ws) {
      // Called when connection closes
    },
    validationError(ws, error) {
      // Called when client message validation fails
      ws.send('error', { message: error.message });
    },
  },
});
```

### Client Usage

The client provides a React-friendly API:

```typescript
import { createWebSocketClient } from '@richie-rpc/client';

const wsClient = createWebSocketClient(wsContract, { baseUrl: 'ws://localhost:3000' });
const chat = wsClient.chat({ params: { roomId: 'general' } });

// Connect (returns disconnect function)
const disconnect = chat.connect();

// Track state
chat.onStateChange((connected) => console.log('Connected:', connected));
chat.onError((error) => console.error('Error:', error));

// Listen for messages
chat.on('message', (payload) => console.log(`${payload.userId}: ${payload.text}`));

// Send messages (validates before sending)
chat.send('sendMessage', { text: 'Hello!' });

// Disconnect when done
disconnect();
```

### React Integration

See `client-react.tsx` for a complete React integration with:
- Custom `useChat` hook
- Connection lifecycle management
- Auto-reconnect handling
- Typing indicators
- Error handling

```typescript
function ChatRoom({ roomId, username }) {
  const { connected, messages, sendMessage, typingUsers } = useChat(roomId, username);

  return (
    <div>
      {messages.map(msg => <div key={msg.id}>{msg.text}</div>)}
      <input onSubmit={(text) => sendMessage(text)} />
    </div>
  );
}
```

## Bun.serve Integration

The server integrates with Bun's WebSocket support:

```typescript
Bun.serve({
  port: 3000,

  websocket: wsRouter.websocketHandler,

  fetch(request, server) {
    const wsMatch = wsRouter.matchAndPrepareUpgrade(request);
    if (wsMatch && request.headers.get('upgrade') === 'websocket') {
      if (server.upgrade(request, { data: wsMatch })) return;
    }
    return new Response('Not Found', { status: 404 });
  },
});
```

## Message Validation

- **Client validates outgoing messages** before sending (throws `ClientValidationError`)
- **Server validates incoming messages** using Zod schemas
- **Server responses are trusted** (not validated for performance)

## Pub/Sub System

The server supports topic-based pub/sub:

```typescript
// Subscribe to a topic
ws.subscribe('room:general');

// Publish to all subscribers (except sender)
ws.publish('room:general', 'message', { text: 'Hello everyone!' });

// Also send to self
ws.send('message', { text: 'Hello everyone!' });

// Unsubscribe
ws.unsubscribe('room:general');
```

## Key Differences from SSE

| Feature | WebSocket | SSE |
|---------|-----------|-----|
| Direction | Bidirectional | Server → Client only |
| Protocol | WebSocket | HTTP |
| Message format | JSON (typed) | Event stream |
| Auto-reconnect | Manual | Built-in |
| Binary data | Yes | No |
| Use case | Chat, games, collaboration | Notifications, feeds |

Use WebSockets when you need bidirectional communication or binary data support.
