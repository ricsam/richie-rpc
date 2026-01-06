# HTTP Streaming Example

This example demonstrates how to use Richie RPC's HTTP streaming feature for AI-style text generation using NDJSON (Newline Delimited JSON) format.

## Overview

HTTP Streaming is ideal for:

- AI text generation (ChatGPT-style responses)
- Long-running computations with progress updates
- Large data processing with incremental results

## Files

- `contract.ts` - Contract definition with streaming endpoints
- `server.ts` - Server implementation with StreamEmitter
- `client.ts` - Client consuming the stream with event-based API

## Running the Example

```bash
# Start the server
bun run server.ts

# In another terminal, run the client
bun run client.ts
```

## How It Works

### Contract Definition

Streaming endpoints use `type: 'streaming'` and define:

- `chunk` - Schema for each streamed chunk
- `finalResponse` - Optional schema for the final response

```typescript
const contract = defineContract({
  generateText: {
    type: 'streaming',
    method: 'POST',
    path: '/ai/generate',
    body: z.object({ prompt: z.string() }),
    chunk: z.object({ text: z.string() }),
    finalResponse: z.object({ totalTokens: z.number() }),
  },
});
```

### Server Handler

Handlers receive a `stream` object with:

- `send(chunk)` - Send a chunk to the client
- `close(final?)` - Close with optional final response
- `isOpen` - Check if client is still connected

```typescript
generateText: async ({ body, stream }) => {
  for (const token of tokens) {
    if (!stream.isOpen) return; // Client disconnected
    stream.send({ text: token });
  }
  stream.close({ totalTokens: tokens.length });
};
```

### Client Usage

The client returns an event-based result:

```typescript
const result = client.generateText({ body: { prompt: 'Hello' } });

result.on('chunk', (chunk) => console.log(chunk.text));
result.on('close', (final) => console.log('Done:', final));
result.on('error', (err) => console.error(err));

// Optionally abort
result.abort();
```

## Wire Format

Chunks are sent as NDJSON (one JSON object per line):

```
{"text":"Hello","tokenIndex":0}
{"text":" world","tokenIndex":1}
{"__final__":true,"data":{"totalTokens":2,"completionTime":150}}
```

The `Content-Type` header is `application/x-ndjson`.
