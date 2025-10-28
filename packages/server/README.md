# @rfetch/server

Server implementation package for RFetch with Bun.serve compatibility.

## Installation

```bash
bun add @rfetch/server @rfetch/core zod
```

## Usage

### Creating a Router

```typescript
import { createRouter } from '@rfetch/server';
import { contract } from './contract';

const router = createRouter(contract, {
  getUser: async ({ params }) => {
    // params is fully typed based on the contract
    const user = await db.getUser(params.id);
    
    if (!user) {
      return { status: 404, body: { error: 'User not found' } };
    }
    
    return { status: 200, body: user };
  },
  
  createUser: async ({ body }) => {
    // body is fully typed and already validated
    const user = await db.createUser(body);
    return { status: 201, body: user };
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

## License

MIT

