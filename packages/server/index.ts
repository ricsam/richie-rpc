import type {
  Contract,
  EndpointDefinition,
  ExtractBody,
  ExtractHeaders,
  ExtractParams,
  ExtractQuery,
} from '@richie-rpc/core';
import { matchPath, parseQuery, Status } from '@richie-rpc/core';
import type { z } from 'zod';

// Re-export Status for convenience
export { Status };

// Handler input types
export type HandlerInput<T extends EndpointDefinition> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  body: ExtractBody<T>;
  request: Request;
};

// Handler response type
export type HandlerResponse<T extends EndpointDefinition> = {
  [Status in keyof T['responses']]: {
    status: Status;
    body: T['responses'][Status] extends z.ZodTypeAny ? z.infer<T['responses'][Status]> : never;
    headers?: Record<string, string>;
  };
}[keyof T['responses']];

// Handler function type
export type Handler<T extends EndpointDefinition> = (
  input: HandlerInput<T>,
) => Promise<HandlerResponse<T>> | HandlerResponse<T>;

// Contract handlers mapping
export type ContractHandlers<T extends Contract> = {
  [K in keyof T]: Handler<T[K]>;
};

// Error classes
export class ValidationError extends Error {
  constructor(
    public field: string,
    public issues: z.ZodIssue[],
    message?: string,
  ) {
    super(message || `Validation failed for ${field}`);
    this.name = 'ValidationError';
  }
}

export class RouteNotFoundError extends Error {
  constructor(
    public path: string,
    public method: string,
  ) {
    super(`Route not found: ${method} ${path}`);
    this.name = 'RouteNotFoundError';
  }
}

/**
 * Parse and validate request data
 */
async function parseRequest<T extends EndpointDefinition>(
  request: Request,
  endpoint: T,
  pathParams: Record<string, string>,
): Promise<HandlerInput<T>> {
  const url = new URL(request.url);

  // Parse path params
  let params: any = pathParams;
  if (endpoint.params) {
    const result = endpoint.params.safeParse(pathParams);
    if (!result.success) {
      throw new ValidationError('params', result.error.issues);
    }
    params = result.data;
  }

  // Parse query params
  let query: any = {};
  if (endpoint.query) {
    const queryData = parseQuery(url.searchParams);
    const result = endpoint.query.safeParse(queryData);
    if (!result.success) {
      throw new ValidationError('query', result.error.issues);
    }
    query = result.data;
  }

  // Parse headers
  let headers: any = {};
  if (endpoint.headers) {
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    const result = endpoint.headers.safeParse(headersObj);
    if (!result.success) {
      throw new ValidationError('headers', result.error.issues);
    }
    headers = result.data;
  }

  // Parse body
  let body: any;
  if (endpoint.body) {
    const contentType = request.headers.get('content-type') || '';
    let bodyData: any;

    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = Object.fromEntries(formData.entries());
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      bodyData = Object.fromEntries(formData.entries());
    } else {
      bodyData = await request.text();
    }

    const result = endpoint.body.safeParse(bodyData);
    if (!result.success) {
      throw new ValidationError('body', result.error.issues);
    }
    body = result.data;
  }

  return { params, query, headers, body, request } as HandlerInput<T>;
}

/**
 * Validate and create response
 */
function createResponse<T extends EndpointDefinition>(
  endpoint: T,
  handlerResponse: HandlerResponse<T>,
): Response {
  const { status, body, headers: customHeaders } = handlerResponse;

  // Validate response body
  const responseSchema = endpoint.responses[status as keyof typeof endpoint.responses];
  if (responseSchema) {
    const result = responseSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(`response[${String(status)}]`, result.error.issues);
    }
  }

  // Create response headers
  const responseHeaders = new Headers(customHeaders);

  // Handle 204 No Content - must have no body
  if (status === 204) {
    return new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  // For all other responses, return JSON
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'application/json');
  }

  return new Response(JSON.stringify(body), {
    status: status as number,
    headers: responseHeaders,
  });
}

/**
 * Create error response
 */
function createErrorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return Response.json(
      {
        error: 'Validation Error',
        field: error.field,
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof RouteNotFoundError) {
    return Response.json({ error: 'Not Found', message: error.message }, { status: 404 });
  }

  console.error('Internal server error:', error);
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}

/**
 * Router class that manages contract endpoints
 */
export class Router<T extends Contract> {
  constructor(
    private contract: T,
    private handlers: ContractHandlers<T>,
  ) {}

  /**
   * Find matching endpoint for a request
   */
  private findEndpoint(
    method: string,
    path: string,
  ): { name: keyof T; endpoint: EndpointDefinition; params: Record<string, string> } | null {
    for (const [name, endpoint] of Object.entries(this.contract)) {
      if (endpoint.method === method) {
        const params = matchPath(endpoint.path, path);
        if (params !== null) {
          return { name, endpoint, params };
        }
      }
    }
    return null;
  }

  /**
   * Handle a request
   */
  async handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;

      const match = this.findEndpoint(method, path);
      if (!match) {
        throw new RouteNotFoundError(path, method);
      }

      const { name, endpoint, params } = match;
      const handler = this.handlers[name];

      // Parse and validate request
      const input = await parseRequest(request, endpoint, params);

      // Call handler
      const handlerResponse = await handler(input as any);

      // Create and validate response
      return createResponse(endpoint as T[keyof T], handlerResponse);
    } catch (error) {
      return createErrorResponse(error);
    }
  }

  /**
   * Get fetch handler compatible with Bun.serve
   */
  get fetch() {
    return (request: Request) => this.handle(request);
  }
}

/**
 * Create a router from a contract and handlers
 */
export function createRouter<T extends Contract>(
  contract: T,
  handlers: ContractHandlers<T>,
): Router<T> {
  return new Router(contract, handlers);
}
