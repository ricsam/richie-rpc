import type {
  Contract,
  EndpointDefinition,
  ExtractBody,
  ExtractHeaders,
  ExtractParams,
  ExtractQuery,
} from '@richie-rpc/core';
import { matchPath, parseQuery, Status, formDataToObject } from '@richie-rpc/core';
import type { z } from 'zod';

// Re-export Status for convenience
export { Status };

// Handler input types
export type HandlerInput<T extends EndpointDefinition, C = unknown> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  body: ExtractBody<T>;
  request: Request;
  context: C;
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
export type Handler<T extends EndpointDefinition, C = unknown> = (
  input: HandlerInput<T, C>,
) => Promise<HandlerResponse<T>> | HandlerResponse<T>;

// Contract handlers mapping
export type ContractHandlers<T extends Contract, C = unknown> = {
  [K in keyof T]: Handler<T[K], C>;
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
async function parseRequest<T extends EndpointDefinition, C = unknown>(
  request: Request,
  endpoint: T,
  pathParams: Record<string, string>,
  context: C,
): Promise<HandlerInput<T, C>> {
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
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      bodyData = formDataToObject(formData);
    } else {
      bodyData = await request.text();
    }

    const result = endpoint.body.safeParse(bodyData);
    if (!result.success) {
      throw new ValidationError('body', result.error.issues);
    }
    body = result.data;
  }

  return { params, query, headers, body, request, context } as HandlerInput<T, C>;
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
 * Router configuration options
 */
export interface RouterOptions<C = unknown> {
  basePath?: string;
  context?: (request: Request, routeName?: string, endpoint?: EndpointDefinition) => C | Promise<C>;
}

/**
 * Router class that manages contract endpoints
 */
export class Router<T extends Contract, C = unknown> {
  private basePath: string;
  private contextFactory?: (
    request: Request,
    routeName: string,
    endpoint: EndpointDefinition,
  ) => C | Promise<C>;

  constructor(
    private contract: T,
    private handlers: ContractHandlers<T, C>,
    options?: RouterOptions<C>,
  ) {
    // Normalize basePath: ensure it starts with / and doesn't end with /
    const bp = options?.basePath || '';
    if (bp) {
      this.basePath = bp.startsWith('/') ? bp : `/${bp}`;
      this.basePath = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
    } else {
      this.basePath = '';
    }
    this.contextFactory = options?.context;
  }

  /**
   * Find matching endpoint for a request
   */
  private findEndpoint(
    method: string,
    path: string,
  ): {
    name: keyof T;
    endpoint: EndpointDefinition;
    params: Record<string, string>;
  } | null {
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
    const url = new URL(request.url);
    const method = request.method;
    let path = url.pathname;

    // Strip basePath if configured
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length) || '/';
    }

    const match = this.findEndpoint(method, path);
    if (!match) {
      throw new RouteNotFoundError(path, method);
    }

    const { name, endpoint, params } = match;
    const handler = this.handlers[name];

    // Create context if factory is provided
    const context = this.contextFactory
      ? await this.contextFactory(request, String(name), endpoint)
      : (undefined as C);

    // Parse and validate request
    const input = await parseRequest(request, endpoint, params, context);

    // Call handler
    const handlerResponse = await handler(input as any);

    // Create and validate response
    return createResponse(endpoint as T[keyof T], handlerResponse);
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
export function createRouter<T extends Contract, C = unknown>(
  contract: T,
  handlers: ContractHandlers<T, C>,
  options?: RouterOptions<C>,
): Router<T, C> {
  return new Router(contract, handlers, options);
}
