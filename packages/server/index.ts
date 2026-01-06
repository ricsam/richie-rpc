import type {
  Contract,
  DownloadEndpointDefinition,
  EndpointDefinition,
  ExtractBody,
  ExtractChunk,
  ExtractFinalResponse,
  ExtractHeaders,
  ExtractParams,
  ExtractQuery,
  ExtractSSEEventData,
  SSEEndpointDefinition,
  StandardEndpointDefinition,
  StreamingEndpointDefinition,
} from '@richie-rpc/core';
import { formDataToObject, matchPath, parseQuery, Status } from '@richie-rpc/core';
import type { z } from 'zod';

// Re-export Status for convenience
export { Status };

// Handler input types (for standard endpoints)
export type HandlerInput<T extends StandardEndpointDefinition, C = unknown> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  body: ExtractBody<T>;
  request: Request;
  context: C;
};

// Handler response type (for standard endpoints)
export type HandlerResponse<T extends StandardEndpointDefinition> = {
  [Status in keyof T['responses']]: {
    status: Status;
    body: T['responses'][Status] extends z.ZodTypeAny ? z.infer<T['responses'][Status]> : never;
    headers?: Record<string, string>;
  };
}[keyof T['responses']];

// Handler function type (for standard endpoints)
export type Handler<T extends StandardEndpointDefinition, C = unknown> = (
  input: HandlerInput<T, C>,
) => Promise<HandlerResponse<T>> | HandlerResponse<T>;

// ============================================
// Streaming Endpoint Types
// ============================================

/**
 * Emitter for streaming responses - push-based API
 */
export interface StreamEmitter<T extends StreamingEndpointDefinition> {
  /** Send a chunk to the client */
  send(chunk: ExtractChunk<T>): void;
  /** Close the stream with optional final response */
  close(final?: ExtractFinalResponse<T>): void;
  /** Check if stream is still open */
  readonly isOpen: boolean;
}

/**
 * Handler input for streaming endpoints
 */
export type StreamingHandlerInput<T extends StreamingEndpointDefinition, C = unknown> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  body: ExtractBody<T>;
  request: Request;
  context: C;
  stream: StreamEmitter<T>;
};

/**
 * Handler function type for streaming endpoints
 */
export type StreamingHandler<T extends StreamingEndpointDefinition, C = unknown> = (
  input: StreamingHandlerInput<T, C>,
) => void | Promise<void>;

// ============================================
// SSE Endpoint Types
// ============================================

/**
 * Emitter for SSE responses
 */
export interface SSEEmitter<T extends SSEEndpointDefinition> {
  /** Send an event to the client */
  send<K extends keyof T['events']>(
    event: K,
    data: ExtractSSEEventData<T, K>,
    options?: { id?: string },
  ): void;
  /** Close the connection */
  close(): void;
  /** Check if connection is still open */
  readonly isOpen: boolean;
}

/**
 * Handler input for SSE endpoints
 */
export type SSEHandlerInput<T extends SSEEndpointDefinition, C = unknown> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  request: Request;
  context: C;
  emitter: SSEEmitter<T>;
  /** AbortSignal for detecting client disconnect */
  signal: AbortSignal;
};

/**
 * Handler function type for SSE endpoints
 * Returns an optional cleanup function
 */
export type SSEHandler<T extends SSEEndpointDefinition, C = unknown> = (
  input: SSEHandlerInput<T, C>,
) => void | (() => void) | Promise<void | (() => void)>;

// ============================================
// Download Endpoint Types
// ============================================

/**
 * Handler input for download endpoints
 */
export type DownloadHandlerInput<T extends DownloadEndpointDefinition, C = unknown> = {
  params: ExtractParams<T>;
  query: ExtractQuery<T>;
  headers: ExtractHeaders<T>;
  request: Request;
  context: C;
};

/**
 * Handler response for download endpoints
 * Success (200) returns File, errors return typed response
 */
export type DownloadHandlerResponse<T extends DownloadEndpointDefinition> =
  | { status: 200; body: File; headers?: Record<string, string> }
  | (T['errorResponses'] extends Record<number, z.ZodTypeAny>
      ? {
          [S in keyof T['errorResponses']]: {
            status: S;
            body: T['errorResponses'][S] extends z.ZodTypeAny
              ? z.infer<T['errorResponses'][S]>
              : never;
            headers?: Record<string, string>;
          };
        }[keyof T['errorResponses']]
      : never);

/**
 * Handler function type for download endpoints
 */
export type DownloadHandler<T extends DownloadEndpointDefinition, C = unknown> = (
  input: DownloadHandlerInput<T, C>,
) => Promise<DownloadHandlerResponse<T>> | DownloadHandlerResponse<T>;

// ============================================
// Contract Handlers (supports all endpoint types)
// ============================================

/**
 * Contract handlers mapping - conditionally applies handler type based on endpoint type
 */
export type ContractHandlers<T extends Contract, C = unknown> = {
  [K in keyof T]: T[K] extends StandardEndpointDefinition
    ? Handler<T[K], C>
    : T[K] extends StreamingEndpointDefinition
      ? StreamingHandler<T[K], C>
      : T[K] extends SSEEndpointDefinition
        ? SSEHandler<T[K], C>
        : T[K] extends DownloadEndpointDefinition
          ? DownloadHandler<T[K], C>
          : never;
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
async function parseRequest<T extends StandardEndpointDefinition, C = unknown>(
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
      bodyData = formDataToObject(formData as FormData);
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
 * Parse and validate request data for streaming endpoints
 */
async function parseStreamingRequest<T extends StreamingEndpointDefinition, C = unknown>(
  request: Request,
  endpoint: T,
  pathParams: Record<string, string>,
  context: C,
): Promise<Omit<StreamingHandlerInput<T, C>, 'stream'>> {
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
      bodyData = formDataToObject(formData as FormData);
    } else {
      bodyData = await request.text();
    }

    const result = endpoint.body.safeParse(bodyData);
    if (!result.success) {
      throw new ValidationError('body', result.error.issues);
    }
    body = result.data;
  }

  return { params, query, headers, body, request, context } as Omit<
    StreamingHandlerInput<T, C>,
    'stream'
  >;
}

/**
 * Parse and validate request data for SSE endpoints
 */
async function parseSSERequest<T extends SSEEndpointDefinition, C = unknown>(
  request: Request,
  endpoint: T,
  pathParams: Record<string, string>,
  context: C,
): Promise<Omit<SSEHandlerInput<T, C>, 'emitter' | 'signal'>> {
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

  // SSE endpoints don't have a body (GET only)
  return { params, query, headers, request, context } as Omit<
    SSEHandlerInput<T, C>,
    'emitter' | 'signal'
  >;
}

/**
 * Parse and validate request data for download endpoints
 */
async function parseDownloadRequest<T extends DownloadEndpointDefinition, C = unknown>(
  request: Request,
  endpoint: T,
  pathParams: Record<string, string>,
  context: C,
): Promise<DownloadHandlerInput<T, C>> {
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

  // Download endpoints don't have a body (GET only)
  return { params, query, headers, request, context } as DownloadHandlerInput<T, C>;
}

/**
 * Validate and create response
 */
function createResponse<T extends StandardEndpointDefinition>(
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
 * Create response for download endpoints
 */
function createDownloadResponse<T extends DownloadEndpointDefinition>(
  _endpoint: T,
  handlerResponse: DownloadHandlerResponse<T>,
): Response {
  const { status, body, headers: customHeaders } = handlerResponse;
  const responseHeaders = new Headers(customHeaders);

  // Success: return File as binary
  if (status === 200 && body instanceof File) {
    if (!responseHeaders.has('content-type')) {
      responseHeaders.set('content-type', body.type || 'application/octet-stream');
    }
    responseHeaders.set('content-length', String(body.size));
    if (!responseHeaders.has('content-disposition')) {
      const filename = encodeURIComponent(body.name);
      responseHeaders.set(
        'content-disposition',
        `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
      );
    }
    return new Response(body, { status: 200, headers: responseHeaders });
  }

  // Error: return JSON
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'application/json');
  }
  return new Response(JSON.stringify(body), {
    status: status as number,
    headers: responseHeaders,
  });
}

/**
 * Create a streaming NDJSON response
 */
function createStreamingResponse<T extends StreamingEndpointDefinition>(
  handler: (stream: StreamEmitter<T>) => void | Promise<void>,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let closed = false;

  const stream: StreamEmitter<T> = {
    send(chunk) {
      if (!closed) {
        writer.write(encoder.encode(`${JSON.stringify(chunk)}\n`));
      }
    },
    close(final) {
      if (!closed) {
        closed = true;
        if (final !== undefined) {
          writer.write(encoder.encode(`${JSON.stringify({ __final__: true, data: final })}\n`));
        }
        writer.close();
      }
    },
    get isOpen() {
      return !closed;
    },
  };

  // Execute handler (don't await - let it run in background)
  Promise.resolve(handler(stream)).catch((err) => {
    console.error('Streaming handler error:', err);
    stream.close();
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Create an SSE response
 */
function createSSEResponse<T extends SSEEndpointDefinition>(
  handler: (
    emitter: SSEEmitter<T>,
    signal: AbortSignal,
  ) => void | (() => void) | Promise<void | (() => void)>,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const controller = new AbortController();
  let closed = false;
  let cleanup: (() => void) | undefined;

  const emitter: SSEEmitter<T> = {
    send(event, data, options) {
      if (!closed) {
        let message = '';
        if (options?.id) {
          message += `id: ${options.id}\n`;
        }
        message += `event: ${String(event)}\n`;
        message += `data: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(message));
      }
    },
    close() {
      if (!closed) {
        closed = true;
        if (cleanup) cleanup();
        writer.close();
      }
    },
    get isOpen() {
      return !closed;
    },
  };

  // Execute handler and get cleanup function
  Promise.resolve(handler(emitter, controller.signal))
    .then((cleanupFn) => {
      if (typeof cleanupFn === 'function') {
        cleanup = cleanupFn;
      }
    })
    .catch((err) => {
      console.error('SSE handler error:', err);
      emitter.close();
    });

  // Tee the stream - one for the response, one for disconnect detection
  const [responseStream, detectStream] = readable.tee();

  // Handle client disconnect by detecting when the stream is cancelled
  detectStream.pipeTo(new WritableStream()).catch(() => {
    controller.abort();
    emitter.close();
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
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

    // Dispatch based on endpoint type
    if (endpoint.type === 'streaming') {
      // Parse request for streaming endpoint
      const input = await parseStreamingRequest(request, endpoint, params, context);
      return createStreamingResponse((stream) => {
        return (handler as StreamingHandler<StreamingEndpointDefinition, C>)({
          ...input,
          stream,
        });
      });
    }

    if (endpoint.type === 'sse') {
      // Parse request for SSE endpoint
      const input = await parseSSERequest(request, endpoint, params, context);
      return createSSEResponse((emitter, signal) => {
        return (handler as SSEHandler<SSEEndpointDefinition, C>)({
          ...input,
          emitter,
          signal,
        });
      });
    }

    if (endpoint.type === 'download') {
      // Parse request for download endpoint
      const input = await parseDownloadRequest(request, endpoint, params, context);
      const downloadHandler = handler as unknown as DownloadHandler<DownloadEndpointDefinition, C>;
      const response = await downloadHandler(
        input as DownloadHandlerInput<DownloadEndpointDefinition, C>,
      );
      return createDownloadResponse(
        endpoint as DownloadEndpointDefinition,
        response as DownloadHandlerResponse<DownloadEndpointDefinition>,
      );
    }

    // Standard endpoint
    const input = await parseRequest(request, endpoint, params, context);
    const standardHandler = handler as unknown as Handler<StandardEndpointDefinition, C>;
    const handlerResponse = await standardHandler(
      input as HandlerInput<StandardEndpointDefinition, C>,
    );
    return createResponse(
      endpoint as StandardEndpointDefinition,
      handlerResponse as HandlerResponse<StandardEndpointDefinition>,
    );
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

export { createWebSocketRouter } from './websocket';