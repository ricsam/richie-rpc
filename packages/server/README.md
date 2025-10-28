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
      418: z.object({ message: z.string(), isTeapot: z.boolean() })
    }
  }
});

const router = createRouter(contract, {
  teapot: async () => {
    return {
      status: 418 as const,
      body: { message: "I'm a teapot", isTeapot: true }
    };
  }
});
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

