# @richie-rpc/openapi

OpenAPI 3.1 specification generator for Richie RPC contracts.

## Installation

```bash
bun add @richie-rpc/openapi @richie-rpc/core zod@^4
```

## Usage

### Generate OpenAPI Spec

```typescript
import { generateOpenAPISpec } from '@richie-rpc/openapi';
import { contract } from './contract';

const spec = generateOpenAPISpec(contract, {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API description',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
});
```

### Generate OpenAPI Spec with basePath

If your API is served under a path prefix, use the `basePath` option to prefix all paths in the spec:

```typescript
const spec = generateOpenAPISpec(contract, {
  info: {
    title: 'My API',
    version: '1.0.0',
  },
  basePath: '/api', // All paths will be prefixed with /api
});

// If contract defines /users, the OpenAPI spec will show /api/users
```

### Serve OpenAPI Spec

```typescript
import { createOpenAPIResponse } from '@richie-rpc/openapi';

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/openapi.json') {
      return createOpenAPIResponse(contract, {
        info: { title: 'My API', version: '1.0.0' },
      });
    }

    // ... other routes
  },
});
```

### Serve API Documentation UI

The package includes support for Scalar API documentation UI:

```typescript
import { createDocsResponse } from '@richie-rpc/openapi';

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/docs') {
      return createDocsResponse('/openapi.json', {
        title: 'My API Documentation',
        layout: 'modern',
      });
    }

    // ... other routes
  },
});
```

## Features

- ✅ OpenAPI 3.1 specification generation
- ✅ Automatic Zod to JSON Schema conversion using Zod v4's built-in `z.toJSONSchema()`
- ✅ No external JSON Schema conversion dependencies
- ✅ Path parameters, query parameters, request bodies
- ✅ Multiple response types per endpoint (including `errorResponses`)
- ✅ BasePath support for prefixing all paths
- ✅ Server and info metadata support
- ✅ Scalar API documentation UI integration
- ✅ Modern, interactive documentation

## API Reference

### `generateOpenAPISpec(contract, options)`

Generates an OpenAPI 3.1 specification from a contract.

**Parameters:**

- `contract`: The Richie RPC contract
- `options.info`: OpenAPI info object (required)
  - `title`: API title
  - `version`: API version
  - `description`: API description (optional)
  - `contact`: Contact information (optional)
  - `license`: License information (optional)
- `options.servers`: Array of server objects (optional)
- `options.basePath`: Path prefix for all endpoints (optional, e.g., `/api`)

**Returns:** OpenAPI specification object

### `createOpenAPIResponse(contract, options)`

Creates a Response object with the OpenAPI spec as JSON.

### `createDocsResponse(openAPIUrl, options)`

Creates a Response object with HTML for Scalar API documentation.

**Parameters:**

- `openAPIUrl`: Path to OpenAPI spec JSON (default: `/openapi.json`)
- `options.title`: Documentation title
- `options.layout`: UI layout (`'modern'` or `'classic'`)
- `options.showToolbar`: Show toolbar (`'always'`, `'never'`, or `'auto'`)
- `options.hideClientButton`: Hide client button (boolean)

## OpenAPI Spec Structure

The generated spec includes:

- **Paths**: All endpoints with their operations
- **Parameters**: Path and query parameters with schemas
- **Request Bodies**: JSON schemas for request bodies
- **Responses**: Status codes mapped to response schemas (both `responses` and `errorResponses` are included)
- **Schemas**: Automatically generated from Zod schemas

## Example Output

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/users/{id}": {
      "get": {
        "operationId": "getUser",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": { ... }
              }
            }
          }
        }
      }
    }
  }
}
```

## Links

- **npm:** https://www.npmjs.com/package/@richie-rpc/openapi
- **Repository:** https://github.com/ricsam/richie-rpc

## License

MIT
