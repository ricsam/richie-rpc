import type { Contract, StandardEndpointDefinition } from '@richie-rpc/core';
import { parsePathParams } from '@richie-rpc/core';
import { z } from 'zod';

/**
 * Parameters for Zod's toJSONSchema function
 * Based on Zod v4's JSONSchemaGeneratorParams and EmitParams
 */
export interface ZodToJSONSchemaParams {
  /** The JSON Schema version to target.
   * - `"draft-2020-12"` — Default. JSON Schema Draft 2020-12
   * - `"draft-7"` — JSON Schema Draft 7
   * - `"draft-4"` — JSON Schema Draft 4
   * - `"openapi-3.0"` — OpenAPI 3.0 Schema Object */
  target?: 'draft-4' | 'draft-7' | 'draft-2020-12' | 'openapi-3.0';
  /** How to handle unrepresentable types.
   * - `"throw"` — Default. Unrepresentable types throw an error
   * - `"any"` — Unrepresentable types become `{}` */
  unrepresentable?: 'throw' | 'any';
  /** Whether to extract the `"input"` or `"output"` type. Relevant to transforms, defaults, coerced primitives, etc.
   * - `"output"` — Default. Convert the output schema.
   * - `"input"` — Convert the input schema. */
  io?: 'input' | 'output';
  /** How to handle cycles.
   * - `"ref"` — Default. Cycles will be broken using $defs
   * - `"throw"` — Cycles will throw an error if encountered */
  cycles?: 'ref' | 'throw';
  /** How to handle reused schemas.
   * - `"ref"` — Extract reused schemas as $defs
   * - `"inline"` — Inline reused schemas */
  reused?: 'ref' | 'inline';
}

// OpenAPI 3.1 types
export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
  };
}

export interface OpenAPIOptions {
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  schemaPrefix?: string;
  basePath?: string;
  jsonSchemaParams?: ZodToJSONSchemaParams;
}

/**
 * Convert Zod schema to JSON Schema for OpenAPI
 */
function zodSchemaToJsonSchema(schema: z.ZodTypeAny, params?: ZodToJSONSchemaParams): any {
  // Zod v4 has built-in JSON Schema support
  // Use 'any' for unrepresentable types like z.instanceof(File) to avoid errors
  const jsonSchema = z.toJSONSchema(schema, {
    unrepresentable: 'any',
    ...params,
  });
  // Remove $schema field as it's not needed in OpenAPI
  if (jsonSchema && typeof jsonSchema === 'object' && '$schema' in jsonSchema) {
    delete jsonSchema.$schema;
  }
  return jsonSchema;
}

/**
 * Convert path parameters to OpenAPI format
 * e.g., "/users/:id" => "/users/{id}"
 * e.g., "/files/*path" => "/files/{path}"
 */
function convertPathToOpenAPI(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}').replace(/\*([^/]+)/g, '{$1}');
}

/**
 * Generate OpenAPI parameter objects for path parameters
 */
function generatePathParameters(
  path: string,
  paramsSchema?: z.ZodTypeAny,
  jsonSchemaParams?: ZodToJSONSchemaParams,
): any[] {
  const paramNames = parsePathParams(path);

  if (paramNames.length === 0) return [];

  // If we have a schema, use it to get types
  let paramSchemas: Record<string, any> = {};
  if (paramsSchema) {
    const jsonSchema = zodSchemaToJsonSchema(paramsSchema, jsonSchemaParams);
    paramSchemas = jsonSchema.properties || {};
  }

  return paramNames.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: paramSchemas[name] || { type: 'string' },
  }));
}

/**
 * Generate OpenAPI parameter objects for query parameters
 */
function generateQueryParameters(
  querySchema?: z.ZodTypeAny,
  jsonSchemaParams?: ZodToJSONSchemaParams,
): any[] {
  if (!querySchema) return [];

  const jsonSchema = zodSchemaToJsonSchema(querySchema, jsonSchemaParams);
  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];

  return Object.entries(properties).map(([name, schema]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    schema,
  }));
}

/**
 * Generate OpenAPI request body object
 */
function generateRequestBody(
  endpoint: StandardEndpointDefinition,
  jsonSchemaParams?: ZodToJSONSchemaParams,
): any {
  if (!endpoint.body) return undefined;

  const contentType = endpoint.contentType ?? 'application/json';
  const schema = zodSchemaToJsonSchema(endpoint.body, jsonSchemaParams);

  return {
    required: true,
    content: {
      [contentType]: { schema },
    },
  };
}

/**
 * Generate OpenAPI responses object
 */
function generateResponses(
  responses: Record<number, z.ZodTypeAny>,
  jsonSchemaParams?: ZodToJSONSchemaParams,
): any {
  const result: any = {};

  for (const [status, schema] of Object.entries(responses)) {
    result[status] = {
      description: getStatusDescription(Number(status)),
      content: {
        'application/json': {
          schema: zodSchemaToJsonSchema(schema, jsonSchemaParams),
        },
      },
    };
  }

  return result;
}

/**
 * Get default description for HTTP status code
 */
function getStatusDescription(status: number): string {
  const descriptions: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return descriptions[status] || 'Response';
}

/**
 * Generate OpenAPI operation object for an endpoint
 */
function generateOperation(
  endpoint: StandardEndpointDefinition,
  operationId: string,
  jsonSchemaParams?: ZodToJSONSchemaParams,
): any {
  const pathParams = generatePathParameters(endpoint.path, endpoint.params, jsonSchemaParams);
  const queryParams = generateQueryParameters(endpoint.query, jsonSchemaParams);
  const parameters = [...pathParams, ...queryParams];

  const allResponses = { ...endpoint.responses };
  if (endpoint.errorResponses) {
    Object.assign(allResponses, endpoint.errorResponses);
  }

  const operation: any = {
    operationId,
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody: generateRequestBody(endpoint, jsonSchemaParams),
    responses: generateResponses(allResponses, jsonSchemaParams),
  };

  // Remove undefined fields
  Object.keys(operation).forEach((key) => {
    if (operation[key] === undefined) {
      delete operation[key];
    }
  });

  return operation;
}

/**
 * Generate OpenAPI specification from a contract
 */
export function generateOpenAPISpec<T extends Contract>(
  contract: T,
  options: OpenAPIOptions,
): OpenAPISpec {
  const paths: Record<string, any> = {};

  // Normalize basePath if provided
  let basePath = '';
  if (options.basePath) {
    basePath = options.basePath.startsWith('/') ? options.basePath : `/${options.basePath}`;
    basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  }

  // Process each endpoint in the contract
  for (const [name, endpoint] of Object.entries(contract)) {
    // Currently only standard endpoints are supported in OpenAPI generation
    // Streaming and SSE endpoints will be added in a future update
    if (endpoint.type !== 'standard') {
      continue;
    }

    let openAPIPath = convertPathToOpenAPI(endpoint.path);

    // Prefix with basePath if provided
    if (basePath) {
      openAPIPath = basePath + openAPIPath;
    }

    const method = endpoint.method.toLowerCase();

    if (!paths[openAPIPath]) {
      paths[openAPIPath] = {};
    }

    paths[openAPIPath][method] = generateOperation(
      endpoint,
      String(name),
      options.jsonSchemaParams,
    );
  }

  const spec: OpenAPISpec = {
    openapi: '3.1.0',
    info: options.info,
    servers: options.servers,
    paths,
  };

  return spec;
}

/**
 * Create a Response object serving the OpenAPI spec
 */
export function createOpenAPIResponse<T extends Contract>(
  contract: T,
  options: OpenAPIOptions,
): Response {
  const spec = generateOpenAPISpec(contract, options);
  return Response.json(spec);
}

/**
 * Create an HTML response serving API documentation with Scalar
 */
export function createDocsResponse(
  openAPIUrl: string = '/openapi.json',
  options: {
    title?: string;
    layout?: 'modern' | 'classic';
    showToolbar?: 'always' | 'never' | 'auto';
    hideClientButton?: boolean;
  } = {},
): Response {
  const {
    title = 'API Reference',
    layout = 'modern',
    showToolbar = 'never',
    hideClientButton = true,
  } = options;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      html,
      body,
      #app {
        height: 100%;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${openAPIUrl}',
        layout: '${layout}',
        metaData: { title: '${title}' },
        showToolbar: '${showToolbar}',
        hideClientButton: ${hideClientButton}
      });
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
