# @richie-rpc/core

Core package for defining type-safe API contracts with Zod schemas.

## Installation

```bash
bun add @richie-rpc/core zod@^4
```

## Usage

### Defining a Contract

```typescript
import { defineContract } from '@richie-rpc/core';
import { z } from 'zod';

const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.object({ id: z.string(), name: z.string() }),
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

### Endpoint Definition Structure

Each endpoint can have:

- `method` (required): HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.)
- `path` (required): URL path with optional parameters (`:id` syntax)
- `params` (optional): Zod schema for path parameters
- `query` (optional): Zod schema for query parameters
- `headers` (optional): Zod schema for request headers
- `body` (optional): Zod schema for request body
- `responses` (required): Object mapping status codes to Zod schemas

## Features

- ✅ Type-safe contract definitions
- ✅ Zod v4+ schema validation
- ✅ Path parameter parsing and interpolation
- ✅ Query parameter handling
- ✅ Multiple response types per endpoint
- ✅ Full TypeScript inference
- ✅ Status code constants for cleaner code

## Utilities

### Path Parameter Utilities

```typescript
import { parsePathParams, matchPath, interpolatePath } from '@richie-rpc/core';

// Parse parameter names from path
parsePathParams('/users/:id/posts/:postId');
// => ['id', 'postId']

// Match a path and extract parameters
matchPath('/users/:id', '/users/123');
// => { id: '123' }

// Interpolate parameters into path
interpolatePath('/users/:id', { id: '123' });
// => '/users/123'
```

### URL Building

```typescript
import { buildUrl } from '@richie-rpc/core';

buildUrl('http://api.example.com', '/users', { limit: '10', offset: '0' });
// => 'http://api.example.com/users?limit=10&offset=0'
```

## Status Codes

Use the `Status` const object for type-safe status codes:

```typescript
import { Status } from '@richie-rpc/core';

const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: UserSchema,
      [Status.NotFound]: ErrorSchema
    }
  }
});
```

Or in handlers (when imported from `@richie-rpc/server`):

```typescript
return { status: Status.OK, body: user };
return { status: Status.NotFound, body: { error: 'Not found' } };
```

**Available constants:**
- Success: `OK` (200), `Created` (201), `Accepted` (202), `NoContent` (204)
- Client Errors: `BadRequest` (400), `Unauthorized` (401), `Forbidden` (403), `NotFound` (404), `Conflict` (409)
- Server Errors: `InternalServerError` (500), `ServiceUnavailable` (503)

## Type Inference

The package exports several utility types for extracting types from endpoint definitions:

- `ExtractParams<T>`: Extract path parameters type
- `ExtractQuery<T>`: Extract query parameters type
- `ExtractHeaders<T>`: Extract headers type
- `ExtractBody<T>`: Extract request body type
- `ExtractResponses<T>`: Extract all response types
- `ExtractResponse<T, Status>`: Extract specific response type by status code

## Links

- **npm:** https://www.npmjs.com/package/@richie-rpc/core
- **Repository:** https://github.com/ricsam/richie-rpc

## License

MIT

