# Richie RPC

[![npm](https://img.shields.io/npm/v/@richie-rpc/core)](https://www.npmjs.com/package/@richie-rpc/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A TypeScript-first, type-safe API contract library for Bun with Zod validation.

**Repository:** https://github.com/ricsam/richie-rpc  
**npm Organization:** https://www.npmjs.com/org/richie-rpc

## Overview

Richie RPC is a monorepo containing 4 packages that work together to provide end-to-end type safety for your API:

1. **@richie-rpc/core** - Define API contracts with Zod schemas
2. **@richie-rpc/server** - Implement servers with automatic validation
3. **@richie-rpc/openapi** - Generate OpenAPI specs from contracts
4. **@richie-rpc/client** - Make type-safe API calls with fetch

## Features

- ✅ **End-to-end type safety** - From contract definition to client usage
- ✅ **Zod v4 validation** - Request and response validation on both client and server with built-in JSON Schema support
- ✅ **OpenAPI 3.1 generation** - Automatic spec generation with Scalar docs UI
- ✅ **BasePath support** - Serve APIs under path prefixes (e.g., `/api`)
- ✅ **Bun-native** - Built specifically for Bun.serve (WHATWG fetch compatible)
- ✅ **Minimal dependencies** - Just Zod, no external schema converters
- ✅ **TypeScript-first** - Full type inference everywhere

## Quick Start

### 1. Define a Contract

```typescript
// contract.ts
import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

export const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ id: z.string(), name: z.string(), email: z.string() }),
      [Status.NotFound]: z.object({ error: z.string() })
    }
  },
  createUser: {
    method: 'POST',
    path: '/users',
    body: z.object({ name: z.string(), email: z.string().email() }),
    responses: {
      [Status.Created]: z.object({ id: z.string(), name: z.string(), email: z.string() })
    }
  }
});
```

### 2. Implement the Server

```typescript
// server.ts
import { createRouter, Status } from '@richie-rpc/server';
import { generateOpenAPISpec, createDocsResponse } from '@richie-rpc/openapi';
import { contract } from './contract';

const router = createRouter(contract, {
  getUser: async ({ params }) => {
    const user = await db.getUser(params.id);
    if (!user) {
      return { status: Status.NotFound, body: { error: 'User not found' } };
    }
    return { status: Status.OK, body: user };
  },
  createUser: async ({ body }) => {
    const user = await db.createUser(body);
    return { status: Status.Created, body: user };
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
import { createClient } from '@richie-rpc/client';
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

All packages require `zod@^4` as a peer dependency. Install it alongside the Richie RPC packages:

```bash
# Install all packages with Zod
bun add @richie-rpc/core @richie-rpc/server @richie-rpc/client @richie-rpc/openapi zod@^4

# Or install individually
bun add @richie-rpc/core zod@^4                    # For contracts
bun add @richie-rpc/server @richie-rpc/core zod@^4 # For servers
bun add @richie-rpc/client @richie-rpc/core zod@^4 # For clients
bun add @richie-rpc/openapi @richie-rpc/core zod@^4 # For OpenAPI
```

**npm Packages:**
- [@richie-rpc/core](https://www.npmjs.com/package/@richie-rpc/core)
- [@richie-rpc/server](https://www.npmjs.com/package/@richie-rpc/server)
- [@richie-rpc/openapi](https://www.npmjs.com/package/@richie-rpc/openapi)
- [@richie-rpc/client](https://www.npmjs.com/package/@richie-rpc/client)

## Packages

### [@richie-rpc/core](./packages/core)

Core package for defining type-safe API contracts.

- Contract definition API
- Type inference utilities
- Path parameter parsing
- URL building utilities

[Read more →](./packages/core/README.md)

### [@richie-rpc/server](./packages/server)

Server implementation with automatic validation for Bun.serve.

- Type-safe request handlers
- Automatic request/response validation
- Path matching and routing
- Error handling

[Read more →](./packages/server/README.md)

### [@richie-rpc/openapi](./packages/openapi)

OpenAPI 3.1 specification generator.

- Contract to OpenAPI conversion
- Zod to JSON Schema conversion
- Scalar API docs UI integration
- Server metadata support

[Read more →](./packages/openapi/README.md)

### [@richie-rpc/client](./packages/client)

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

## Why Richie RPC?

### vs ts-rest

- ✅ Supports latest Zod v4 with built-in JSON Schema
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
richie-rpc/
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
- Zod 4.1+

## CI/CD

The project uses GitHub Actions for continuous integration and deployment:

### CI Pipeline (All Branches)
- ✅ Type checking with TypeScript
- ✅ Linting with Biome
- ✅ Build all packages
- ✅ Run integration tests
- ✅ Run E2E tests with Playwright

### CD Pipeline (Main Branch)
- ✅ All CI checks must pass first
- ✅ Check each package individually against npm registry
- ✅ Publish only packages with new versions
- ✅ Create individual git tags per package (e.g., `core@v1.1.0`)

To trigger a publish, update version numbers in the packages you want to release and push to main. See [VERSIONING.md](./VERSIONING.md) for details.

### Branch Protection

To enforce CI checks before merging PRs, configure branch protection rules. See [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for step-by-step setup instructions.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

## Development

### Type Checking and Linting

```bash
bun run typecheck      # Type check all packages
bun run lint           # Lint all files with Biome
bun run lint:fix       # Auto-fix linting issues
bun run format         # Format code with Biome
```

### Building for npm

To build the packages for npm publishing:

```bash
bun run build          # Build all packages
bun run publish:all    # Publish to npm (requires npm login)
bun run restore        # Restore development state
```

See [BUILD.md](./BUILD.md) for detailed build and publishing instructions, and [VERSIONING.md](./VERSIONING.md) for versioning strategy.

## Links

- **Repository:** https://github.com/ricsam/richie-rpc
- **npm Organization:** https://www.npmjs.com/org/richie-rpc
- **Issues:** https://github.com/ricsam/richie-rpc/issues
- **Author:** Richie <oss@ricsam.dev>

## License

MIT

## Credits

Inspired by [ts-rest](https://ts-rest.com/) but built specifically for Bun with modern Zod support.
