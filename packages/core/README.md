# @richie-rpc/core

Core package for defining type-safe API contracts with Zod schemas.

## Installation

```bash
bun add @richie-rpc/core zod@^4
```

## Usage

### Defining a Contract

```typescript
import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ id: z.string(), name: z.string() }),
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

### Endpoint Definition Structure

Each endpoint can have:

- `method` (required): HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.)
- `path` (required): URL path with optional parameters (`:id` syntax)
- `params` (optional): Zod schema for path parameters
- `query` (optional): Zod schema for query parameters
- `headers` (optional): Zod schema for request headers
- `body` (optional): Zod schema for request body
- `contentType` (optional): Request content type (`'application/json'` or `'multipart/form-data'`)
- `responses` (required): Object mapping status codes to Zod schemas

## Features

- ✅ Type-safe contract definitions
- ✅ Zod v4+ schema validation
- ✅ Path parameter parsing and interpolation
- ✅ Query parameter handling
- ✅ Multiple response types per endpoint
- ✅ Full TypeScript inference
- ✅ Status code constants for cleaner code
- ✅ File uploads with `multipart/form-data` support
- ✅ Nested file structures in request bodies

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

// With basePath in baseUrl
buildUrl('http://api.example.com/api', '/users');
// => 'http://api.example.com/api/users'
```

The `buildUrl` function properly concatenates the baseUrl with the path, supporting basePath prefixes in the baseUrl.

### File Upload / FormData Utilities

The core package provides utilities for handling `multipart/form-data` requests with nested file structures.

#### Defining File Upload Endpoints

Use `contentType: 'multipart/form-data'` and `z.instanceof(File)` in your body schema:

```typescript
import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

const contract = defineContract({
  uploadDocuments: {
    method: 'POST',
    path: '/upload',
    contentType: 'multipart/form-data',
    body: z.object({
      documents: z.array(z.object({
        file: z.instanceof(File),
        name: z.string(),
        tags: z.array(z.string()).optional(),
      })),
      category: z.string(),
    }),
    responses: {
      [Status.Created]: z.object({
        uploadedCount: z.number(),
        filenames: z.array(z.string()),
      }),
    },
  },
});
```

#### How It Works

FormData is inherently flat, but Richie RPC supports nested structures using a hybrid JSON + Files approach:

1. **Client-side**: Files are extracted from the object and replaced with `{ __fileRef__: "path" }` placeholders. The JSON structure is sent as `__json__` and files are sent as separate FormData entries.

2. **Server-side**: The JSON is parsed, and `__fileRef__` placeholders are replaced with actual File objects from the FormData.

#### Utility Functions

```typescript
import { objectToFormData, formDataToObject } from '@richie-rpc/core';

// Client-side: Convert object with Files to FormData
const formData = objectToFormData({
  documents: [
    { file: file1, name: 'doc1.pdf' },
    { file: file2, name: 'doc2.pdf' },
  ],
  category: 'reports',
});
// Result: FormData with __json__ + files at "documents.0.file", "documents.1.file"

// Server-side: Convert FormData back to object with Files
const obj = formDataToObject(formData);
// Result: { documents: [{ file: File, name: 'doc1.pdf' }, ...], category: 'reports' }
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
- Client Errors: `BadRequest` (400), `Unauthorized` (401), `Forbidden` (403), `NotFound` (404), `Conflict` (409), `UnprocessableEntity` (422), `TooManyRequests` (429)
- Server Errors: `InternalServerError` (500), `BadGateway` (502), `ServiceUnavailable` (503)

**Using custom status codes:**

For status codes not in the `Status` object, use numeric literals in the contract:

```typescript
const contract = defineContract({
  customEndpoint: {
    method: 'GET',
    path: '/teapot',
    responses: {
      [Status.OK]: z.object({ message: z.string() }),
      418: z.object({ message: z.string() }), // I'm a teapot
      451: z.object({ reason: z.string() }), // Unavailable for legal reasons
    }
  }
});
```

Then use `as const` in the handler response:

```typescript
return { status: 418 as const, body: { message: "I'm a teapot" } };
```

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

