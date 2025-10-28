# @rfetch/openapi

OpenAPI 3.1 specification generator for RFetch contracts.

## Installation

```bash
bun add @rfetch/openapi @rfetch/core zod
```

## Usage

### Generate OpenAPI Spec

```typescript
import { generateOpenAPISpec } from '@rfetch/openapi';
import { contract } from './contract';

const spec = generateOpenAPISpec(contract, {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API description',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    }
  },
  servers: [
    {
      url: 'https://api.example.com',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ]
});
```

### Serve OpenAPI Spec

```typescript
import { createOpenAPIResponse } from '@rfetch/openapi';

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/openapi.json') {
      return createOpenAPIResponse(contract, {
        info: { title: 'My API', version: '1.0.0' }
      });
    }
    
    // ... other routes
  }
});
```

### Serve API Documentation UI

The package includes support for Scalar API documentation UI:

```typescript
import { createDocsResponse } from '@rfetch/openapi';

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/docs') {
      return createDocsResponse('/openapi.json', {
        title: 'My API Documentation',
        layout: 'modern'
      });
    }
    
    // ... other routes
  }
});
```

## Features

- ✅ OpenAPI 3.1 specification generation
- ✅ Automatic Zod to JSON Schema conversion
- ✅ Path parameters, query parameters, request bodies
- ✅ Multiple response types per endpoint
- ✅ Server and info metadata support
- ✅ Scalar API documentation UI integration
- ✅ Modern, interactive documentation

## API Reference

### `generateOpenAPISpec(contract, options)`

Generates an OpenAPI 3.1 specification from a contract.

**Parameters:**
- `contract`: The RFetch contract
- `options.info`: OpenAPI info object (required)
  - `title`: API title
  - `version`: API version
  - `description`: API description (optional)
  - `contact`: Contact information (optional)
  - `license`: License information (optional)
- `options.servers`: Array of server objects (optional)

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
- **Responses**: Status codes mapped to response schemas
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

## License

MIT

