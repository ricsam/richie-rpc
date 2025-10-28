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
  }
});
```

### Using with Bun.serve

```typescript
Bun.serve({
  port: 3000,
  fetch: router.fetch
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
  }
});
```

## Features

- ✅ Automatic request validation (params, query, headers, body)
- ✅ Automatic response validation
- ✅ Type-safe handler inputs
- ✅ Type-safe status codes with `Status` const object
- ✅ Path parameter matching
- ✅ Query parameter parsing
- ✅ JSON body parsing
- ✅ Form data support
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

return { status: Status.OK, body: user };           // 200
return { status: Status.Created, body: newUser };   // 201
return { status: Status.NoContent, body: {} };      // 204
return { status: Status.BadRequest, body: error };  // 400
return { status: Status.NotFound, body: error };    // 404
```

Available status codes:
- `Status.OK` (200), `Status.Created` (201), `Status.Accepted` (202), `Status.NoContent` (204)
- `Status.BadRequest` (400), `Status.Unauthorized` (401), `Status.Forbidden` (403), `Status.NotFound` (404)
- `Status.Conflict` (409), `Status.UnprocessableEntity` (422), `Status.TooManyRequests` (429)
- `Status.InternalServerError` (500), `Status.ServiceUnavailable` (503)

You can also use literal numbers with `as const`:
```typescript
return { status: 200 as const, body: user };
```

## Error Handling

The router automatically handles:

- **Validation Errors** (400): Invalid request data
- **Route Not Found** (404): Unknown endpoints
- **Internal Errors** (500): Uncaught exceptions

Custom error responses:

```typescript
return {
  status: 400,
  body: { error: 'Bad Request', message: 'Invalid input' }
};
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

