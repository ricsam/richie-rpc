# @richie-rpc/client

Type-safe fetch client for Richie RPC contracts.

## Installation

```bash
bun add @richie-rpc/client @richie-rpc/core zod@^4
```

## Usage

### Creating a Client

```typescript
import { createClient } from '@richie-rpc/client';
import { contract } from './contract';

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token123'
  }
});
```

### Client with basePath

The `baseUrl` supports both absolute and relative URLs:

```typescript
// Absolute URL with path prefix
const client = createClient(contract, {
  baseUrl: 'https://api.example.com/api',
});

// Relative URL with path prefix (browser-friendly)
const client = createClient(contract, {
  baseUrl: '/api',  // Resolves to current origin + /api
});

// Just the path (same origin)
const client = createClient(contract, {
  baseUrl: '/',  // Resolves to current origin
});
```

**How it works:**
- **Absolute URLs** (`http://...` or `https://...`): Used as-is
- **Relative URLs** (starting with `/`): Automatically resolved using `window.location.origin` in browsers, or `http://localhost` in non-browser environments

**Example:** In a browser at `https://example.com`, if your contract defines `/users`:
- With `baseUrl: '/api'` → actual URL is `https://example.com/api/users`
- With `baseUrl: '/'` → actual URL is `https://example.com/users`

### Making Requests

The client provides fully typed methods for each endpoint in your contract:

```typescript
// GET request with path parameters
const user = await client.getUser({ 
  params: { id: '123' } 
});
// user is typed based on the response schema

// POST request with body
const newUser = await client.createUser({
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// Request with query parameters
const users = await client.listUsers({
  query: {
    limit: '10',
    offset: '0'
  }
});

// Request with custom headers
const data = await client.getData({
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## Features

- ✅ Full type safety based on contract
- ✅ Automatic path parameter interpolation
- ✅ Query parameter encoding
- ✅ BasePath support in baseUrl
- ✅ Request validation before sending
- ✅ Response validation after receiving
- ✅ Detailed error information
- ✅ Support for all HTTP methods
- ✅ Custom headers per request

## Configuration

### ClientConfig Options

```typescript
interface ClientConfig {
  baseUrl: string;                    // Base URL for all requests
  headers?: Record<string, string>;   // Default headers
  validateRequest?: boolean;          // Validate before sending (default: true)
  validateResponse?: boolean;         // Validate after receiving (default: true)
}
```

## Response Format

Responses include both the status code and data:

```typescript
const response = await client.getUser({ params: { id: '123' } });

console.log(response.status); // 200, 404, etc.
console.log(response.data);   // Typed response body
```

## Error Handling

The client throws typed errors for different scenarios:

### ClientValidationError

Thrown when request data fails validation:

```typescript
try {
  await client.createUser({
    body: { email: 'invalid-email' }
  });
} catch (error) {
  if (error instanceof ClientValidationError) {
    console.log(error.field);  // 'body'
    console.log(error.issues); // Zod validation issues
  }
}
```

### HTTPError

Thrown for unexpected HTTP status codes:

```typescript
try {
  await client.getUser({ params: { id: '999' } });
} catch (error) {
  if (error instanceof HTTPError) {
    console.log(error.status);     // 404
    console.log(error.statusText); // 'Not Found'
    console.log(error.body);       // Response body
  }
}
```

## Type Safety

All client methods are fully typed based on your contract:

```typescript
// ✅ Type-safe: required fields
await client.createUser({
  body: { name: 'John', email: 'john@example.com' }
});

// ❌ Type error: missing required field
await client.createUser({
  body: { name: 'John' }
});

// ✅ Type-safe: response data
const user = await client.getUser({ params: { id: '123' } });
console.log(user.data.name); // string

// ❌ Type error: invalid property
console.log(user.data.invalid);
```

## Request Options

Each client method accepts an options object with the following fields (based on the endpoint definition):

- `params`: Path parameters (if endpoint has params schema)
- `query`: Query parameters (if endpoint has query schema)
- `headers`: Custom headers (if endpoint has headers schema)
- `body`: Request body (if endpoint has body schema)

Only the fields defined in the contract are available and typed.

## Validation

By default, both request and response data are validated:

- **Request validation**: Ensures data conforms to schema before sending
- **Response validation**: Ensures server response matches expected schema

You can disable validation:

```typescript
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  validateRequest: false,  // Skip request validation
  validateResponse: false  // Skip response validation
});
```

## Links

- **npm:** https://www.npmjs.com/package/@richie-rpc/client
- **Repository:** https://github.com/ricsam/richie-rpc

## License

MIT

