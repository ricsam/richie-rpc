# RFetch

A TypeScript-first, type-safe API contract library for Bun with Zod validation.

## Overview

RFetch is a monorepo containing 4 packages that work together to provide end-to-end type safety for your API:

1. **@rfetch/core** - Define API contracts with Zod schemas
2. **@rfetch/server** - Implement servers with automatic validation
3. **@rfetch/openapi** - Generate OpenAPI specs from contracts
4. **@rfetch/client** - Make type-safe API calls with fetch

## Features

- ✅ **End-to-end type safety** - From contract definition to client usage
- ✅ **Zod v3+ validation** - Request and response validation on both client and server
- ✅ **OpenAPI 3.1 generation** - Automatic spec generation with Scalar docs UI
- ✅ **Bun-native** - Built specifically for Bun.serve (WHATWG fetch compatible)
- ✅ **Zero dependencies** - Minimal core with optional extensions
- ✅ **TypeScript-first** - Full type inference everywhere

## Quick Start

### 1. Define a Contract

```typescript
// contract.ts
import { defineContract } from '@rfetch/core';
import { z } from 'zod';

export const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.object({ id: z.string(), name: z.string(), email: z.string() }),
      404: z.object({ error: z.string() })
    }
  },
  createUser: {
    method: 'POST',
    path: '/users',
    body: z.object({ name: z.string(), email: z.string().email() }),
    responses: {
      201: z.object({ id: z.string(), name: z.string(), email: z.string() })
    }
  }
});
```

### 2. Implement the Server

```typescript
// server.ts
import { createRouter } from '@rfetch/server';
import { generateOpenAPISpec, createDocsResponse } from '@rfetch/openapi';
import { contract } from './contract';

const router = createRouter(contract, {
  getUser: async ({ params }) => {
    const user = await db.getUser(params.id);
    if (!user) {
      return { status: 404, body: { error: 'User not found' } };
    }
    return { status: 200, body: user };
  },
  createUser: async ({ body }) => {
    const user = await db.createUser(body);
    return { status: 201, body: user };
  }
});

const openAPISpec = generateOpenAPISpec(contract, {
  info: { title: 'My API', version: '1.0.0' }
});

Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/openapi.json') {
      return Response.json(openAPISpec);
    }
    
    if (url.pathname === '/docs') {
      return createDocsResponse('/openapi.json');
    }
    
    return router.fetch(request);
  }
});
```

### 3. Use the Client

```typescript
// client.ts
import { createClient } from '@rfetch/client';
import { contract } from './contract';

const client = createClient(contract, {
  baseUrl: 'http://localhost:3000'
});

// Fully typed!
const user = await client.getUser({ params: { id: '123' } });
console.log(user.data.name); // ✅ Type-safe

const newUser = await client.createUser({
  body: { name: 'Alice', email: 'alice@example.com' }
});
console.log(newUser.data.id); // ✅ Type-safe
```

## Installation

```bash
# Install all packages
bun add @rfetch/core @rfetch/server @rfetch/client @rfetch/openapi zod

# Or install individually
bun add @rfetch/core zod          # For contracts
bun add @rfetch/server            # For servers
bun add @rfetch/client            # For clients
bun add @rfetch/openapi           # For OpenAPI generation
```

## Packages

### [@rfetch/core](./packages/core)

Core package for defining type-safe API contracts.

- Contract definition API
- Type inference utilities
- Path parameter parsing
- URL building utilities

[Read more →](./packages/core/README.md)

### [@rfetch/server](./packages/server)

Server implementation with automatic validation for Bun.serve.

- Type-safe request handlers
- Automatic request/response validation
- Path matching and routing
- Error handling

[Read more →](./packages/server/README.md)

### [@rfetch/openapi](./packages/openapi)

OpenAPI 3.1 specification generator.

- Contract to OpenAPI conversion
- Zod to JSON Schema conversion
- Scalar API docs UI integration
- Server metadata support

[Read more →](./packages/openapi/README.md)

### [@rfetch/client](./packages/client)

Type-safe fetch client for consuming APIs.

- Fully typed API methods
- Automatic validation
- Path parameter interpolation
- Custom headers support

[Read more →](./packages/client/README.md)

## Demo

A complete working example is available in the [`packages/demo`](./packages/demo) directory.

### Quick Verification

```bash
cd packages/demo
./verify.sh
```

This runs all integration tests and verifies the API, OpenAPI spec, and documentation UI.

### Manual Testing

```bash
# Start the server
cd packages/demo
bun run start

# In another terminal, run client tests
bun run client-test.ts

# Run E2E tests with Playwright (note: starts its own server)
lsof -ti:3000 | xargs kill -9  # Kill existing server first
bun run test:e2e
```

Visit:
- http://localhost:3000/docs - Interactive API documentation UI (Scalar)
- http://localhost:3000/openapi.json - OpenAPI 3.1 specification
- http://localhost:3000/users - API endpoints

See [TESTING.md](./TESTING.md) for detailed testing instructions.

## Why RFetch?

### vs ts-rest

- ✅ Supports latest Zod v3+
- ✅ Built specifically for Bun (not Node.js/Express)
- ✅ Simpler API with fewer concepts
- ✅ Native WHATWG fetch compatibility

### vs tRPC

- ✅ REST-based (not RPC)
- ✅ OpenAPI spec generation
- ✅ Works with any HTTP client
- ✅ Standard REST conventions

### vs Manual Fetch + Zod

- ✅ Automatic validation on client and server
- ✅ Single source of truth (contract)
- ✅ Type inference everywhere
- ✅ Less boilerplate

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Contract (Core)                     │
│  Single source of truth with Zod schemas              │
└─────────────┬─────────────────────────┬─────────────────┘
              │                         │
     ┌────────▼────────┐       ┌────────▼─────────┐
     │  Server         │       │  Client          │
     │  - Validation   │       │  - Type-safe     │
     │  - Routing      │       │  - Validation    │
     │  - Handlers     │       │  - Fetch wrapper │
     └────────┬────────┘       └──────────────────┘
              │
     ┌────────▼────────┐
     │  OpenAPI        │
     │  - Spec gen     │
     │  - Docs UI      │
     └─────────────────┘
```

## Project Structure

```
rfetch/
├── packages/
│   ├── core/         - Contract definitions and utilities
│   ├── server/       - Server implementation
│   ├── openapi/      - OpenAPI spec generator
│   ├── client/       - Type-safe client
│   └── demo/         - Integration tests and examples
├── package.json      - Workspace configuration
└── tsconfig.json     - Shared TypeScript config
```

## Requirements

- Bun 1.0+
- TypeScript 5.0+
- Zod 3.23+

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Credits

Inspired by [ts-rest](https://ts-rest.com/) but built specifically for Bun with modern Zod support.
