/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Contract,
  DownloadEndpointDefinition,
  DownloadProgressEvent,
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
  UploadProgressEvent,
} from '@richie-rpc/core';
import { buildUrl, interpolatePath, objectToFormData } from '@richie-rpc/core';

// Re-export for convenience
export type { UploadProgressEvent, DownloadProgressEvent };
import type { z } from 'zod';

// Client configuration
export interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  validateRequest?: boolean;
  validateResponse?: boolean;
}

// Request options for an endpoint
export type EndpointRequestOptions<T extends EndpointDefinition> = {
  params?: ExtractParams<T> extends never ? never : ExtractParams<T>;
  query?: ExtractQuery<T> extends never ? never : ExtractQuery<T>;
  headers?: ExtractHeaders<T> extends never ? never : ExtractHeaders<T>;
  body?: ExtractBody<T> extends never ? never : ExtractBody<T>;
  abortSignal?: AbortSignal;
  /** Upload progress callback (uses XHR for progress tracking) */
  onUploadProgress?: (event: UploadProgressEvent) => void;
};

// Response type for a standard endpoint (union of all possible responses)
export type EndpointResponse<T extends StandardEndpointDefinition> = {
  [Status in keyof T['responses']]: {
    status: Status;
    data: T['responses'][Status] extends z.ZodTypeAny ? z.infer<T['responses'][Status]> : never;
  };
}[keyof T['responses']];

// Client method type for a standard endpoint
export type ClientMethod<T extends StandardEndpointDefinition> = (
  options: EndpointRequestOptions<T>,
) => Promise<EndpointResponse<T>>;

// ============================================
// Streaming Endpoint Client Types
// ============================================

/**
 * Result object for streaming endpoints - event-based API
 */
export interface StreamingResult<T extends StreamingEndpointDefinition> {
  /** Subscribe to chunks */
  on(event: 'chunk', handler: (chunk: ExtractChunk<T>) => void): () => void;
  /** Subscribe to stream close (with optional final response) */
  on(event: 'close', handler: (final?: ExtractFinalResponse<T>) => void): () => void;
  /** Subscribe to errors */
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Abort the stream */
  abort(): void;
  /** Check if aborted */
  readonly aborted: boolean;
}

/**
 * Client method type for streaming endpoints
 */
export type StreamingClientMethod<T extends StreamingEndpointDefinition> = (
  options: EndpointRequestOptions<T>,
) => Promise<StreamingResult<T>>;

// ============================================
// SSE Endpoint Client Types
// ============================================

/**
 * Connection object for SSE endpoints - event-based API
 */
export interface SSEConnection<T extends SSEEndpointDefinition> {
  /** Subscribe to a specific event type */
  on<K extends keyof T['events']>(
    event: K,
    handler: (data: ExtractSSEEventData<T, K>, id?: string) => void,
  ): () => void;
  /** Subscribe to errors */
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Close the connection */
  close(): void;
  /** Current connection state */
  readonly state: 'connecting' | 'open' | 'closed';
}

/**
 * Client method type for SSE endpoints
 */
export type SSEClientMethod<T extends SSEEndpointDefinition> = (
  options?: Omit<EndpointRequestOptions<T>, 'body' | 'onUploadProgress'>,
) => SSEConnection<T>;

// ============================================
// Download Endpoint Client Types
// ============================================

/**
 * Request options for download endpoints
 */
export type DownloadRequestOptions<T extends DownloadEndpointDefinition> = {
  params?: ExtractParams<T> extends never ? never : ExtractParams<T>;
  query?: ExtractQuery<T> extends never ? never : ExtractQuery<T>;
  headers?: ExtractHeaders<T> extends never ? never : ExtractHeaders<T>;
  abortSignal?: AbortSignal;
  /** Download progress callback */
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
};

/**
 * Response type for download endpoints
 * Success (200) returns File, errors return typed error response
 */
export type DownloadResponse<T extends DownloadEndpointDefinition> =
  | { status: 200; data: File }
  | (T['errorResponses'] extends Record<number, z.ZodTypeAny>
      ? {
          [S in keyof T['errorResponses']]: {
            status: S;
            data: T['errorResponses'][S] extends z.ZodTypeAny
              ? z.infer<T['errorResponses'][S]>
              : never;
          };
        }[keyof T['errorResponses']]
      : never);

/**
 * Client method type for download endpoints
 */
export type DownloadClientMethod<T extends DownloadEndpointDefinition> = (
  options?: DownloadRequestOptions<T>,
) => Promise<DownloadResponse<T>>;

// Client type for a contract (supports all endpoint types)
export type Client<T extends Contract> = {
  [K in keyof T]: T[K] extends StandardEndpointDefinition
    ? ClientMethod<T[K]>
    : T[K] extends StreamingEndpointDefinition
      ? StreamingClientMethod<T[K]>
      : T[K] extends SSEEndpointDefinition
        ? SSEClientMethod<T[K]>
        : T[K] extends DownloadEndpointDefinition
          ? DownloadClientMethod<T[K]>
          : never;
};

// Validation error
export class ClientValidationError extends Error {
  constructor(
    public field: string,
    public issues: z.ZodIssue[],
  ) {
    super(`Validation failed for ${field}`);
    this.name = 'ClientValidationError';
  }
}

// HTTP error
export class HTTPError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`HTTP Error ${status}: ${statusText}`);
    this.name = 'HTTPError';
  }
}

/**
 * Validate request data before sending
 */
function validateRequest<T extends StandardEndpointDefinition>(
  endpoint: T,
  options: EndpointRequestOptions<T>,
): void {
  // Validate params
  if (endpoint.params && options.params) {
    const result = endpoint.params.safeParse(options.params);
    if (!result.success) {
      throw new ClientValidationError('params', result.error.issues);
    }
  }

  // Validate query
  if (endpoint.query && options.query) {
    const result = endpoint.query.safeParse(options.query);
    if (!result.success) {
      throw new ClientValidationError('query', result.error.issues);
    }
  }

  // Validate headers
  if (endpoint.headers && options.headers) {
    const result = endpoint.headers.safeParse(options.headers);
    if (!result.success) {
      throw new ClientValidationError('headers', result.error.issues);
    }
  }

  // Validate body
  if (endpoint.body && options.body) {
    const result = endpoint.body.safeParse(options.body);
    if (!result.success) {
      throw new ClientValidationError('body', result.error.issues);
    }
  }
}

/**
 * Validate response data after receiving
 */
function validateResponse<T extends StandardEndpointDefinition>(
  endpoint: T,
  status: number,
  data: unknown,
): void {
  const responseSchema = endpoint.responses[status];
  if (responseSchema) {
    const result = responseSchema.safeParse(data);
    if (!result.success) {
      throw new ClientValidationError(`response[${status}]`, result.error.issues);
    }
  }
}

/**
 * Extract filename from Content-Disposition header
 */
function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  // Try filename*= (RFC 5987) first
  const filenameStarMatch = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;\s]+)/i);
  if (filenameStarMatch && filenameStarMatch[1]) {
    return decodeURIComponent(filenameStarMatch[1]);
  }
  // Try filename= (standard)
  const filenameMatch = contentDisposition.match(/filename=["']?([^"';\s]+)["']?/i);
  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1];
  }
  return null;
}

/**
 * Validate download request data before sending
 */
function validateDownloadRequest<T extends DownloadEndpointDefinition>(
  endpoint: T,
  options: DownloadRequestOptions<T>,
): void {
  // Validate params
  if (endpoint.params && options.params) {
    const result = endpoint.params.safeParse(options.params);
    if (!result.success) {
      throw new ClientValidationError('params', result.error.issues);
    }
  }

  // Validate query
  if (endpoint.query && options.query) {
    const result = endpoint.query.safeParse(options.query);
    if (!result.success) {
      throw new ClientValidationError('query', result.error.issues);
    }
  }

  // Validate headers
  if (endpoint.headers && options.headers) {
    const result = endpoint.headers.safeParse(options.headers);
    if (!result.success) {
      throw new ClientValidationError('headers', result.error.issues);
    }
  }
}

/**
 * Validate download error response data
 */
function validateDownloadErrorResponse<T extends DownloadEndpointDefinition>(
  endpoint: T,
  status: number,
  data: unknown,
): void {
  if (endpoint.errorResponses) {
    const responseSchema = endpoint.errorResponses[status];
    if (responseSchema) {
      const result = responseSchema.safeParse(data);
      if (!result.success) {
        throw new ClientValidationError(`response[${status}]`, result.error.issues);
      }
    }
  }
}

/**
 * Make a download request using fetch with progress support
 */
async function makeDownloadRequest<T extends DownloadEndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: DownloadRequestOptions<T> = {},
): Promise<DownloadResponse<T>> {
  // Validate request if enabled
  if (config.validateRequest !== false) {
    validateDownloadRequest(endpoint, options);
  }

  // Build URL
  let path = endpoint.path;
  if (options.params) {
    path = interpolatePath(path, options.params as Record<string, string | number>);
  }

  const url = buildUrl(
    config.baseUrl,
    path,
    options.query as Record<string, string | number | boolean | string[]> | undefined,
  );

  // Build headers
  const headers = new Headers(config.headers);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, String(value));
    }
  }

  // Build request init
  const init: RequestInit = {
    method: 'GET',
    headers,
  };

  // Add abort signal if present
  if (options.abortSignal) {
    init.signal = options.abortSignal;
  }

  // Make request
  const response = await fetch(url, init);

  // Handle success (200) - return File
  if (response.status === 200) {
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let blob: Blob;

    if (options.onDownloadProgress && response.body) {
      // Stream the response to track progress
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        options.onDownloadProgress({
          loaded,
          total,
          progress: total > 0 ? loaded / total : NaN,
        });
      }

      blob = new Blob(chunks);
    } else {
      blob = await response.blob();
    }

    const contentDisposition = response.headers.get('content-disposition');
    const filename = extractFilename(contentDisposition) || 'download';
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    const file = new File([blob], filename, { type: contentType });

    return {
      status: 200,
      data: file,
    } as DownloadResponse<T>;
  }

  // Handle error responses
  let data: unknown;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Check for HTTP errors not in errorResponses
  if (endpoint.errorResponses && !(response.status in endpoint.errorResponses)) {
    throw new HTTPError(response.status, response.statusText, data);
  }

  // Validate error response if enabled
  if (config.validateResponse !== false) {
    validateDownloadErrorResponse(endpoint, response.status, data);
  }

  return {
    status: response.status,
    data,
  } as DownloadResponse<T>;
}

/**
 * Make a request using XMLHttpRequest for upload progress support
 */
function makeRequestWithXHR<T extends StandardEndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>,
  url: string,
): Promise<EndpointResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(endpoint.method, url);

    // Set base headers from config
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        xhr.setRequestHeader(key, value);
      }
    }

    // Set request-specific headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        xhr.setRequestHeader(key, String(value));
      }
    }

    // Upload progress callback
    if (options.onUploadProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && options.onUploadProgress) {
          options.onUploadProgress({
            loaded: e.loaded,
            total: e.total,
            progress: e.loaded / e.total,
          });
        }
      };
    }

    // Handle abort signal
    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      options.abortSignal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.onload = () => {
      let data: unknown;
      const responseContentType = xhr.getResponseHeader('content-type') || '';

      if (xhr.status === 204) {
        data = {};
      } else if (responseContentType.includes('application/json')) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = xhr.responseText || {};
        }
      } else if (responseContentType.includes('text/')) {
        data = xhr.responseText;
      } else {
        data = xhr.responseText || {};
      }

      // Check for HTTP errors
      if (xhr.status >= 400 && !(xhr.status in endpoint.responses)) {
        reject(new HTTPError(xhr.status, xhr.statusText, data));
        return;
      }

      // Validate response if enabled
      if (config.validateResponse !== false) {
        try {
          validateResponse(endpoint, xhr.status, data);
        } catch (err) {
          reject(err);
          return;
        }
      }

      resolve({
        status: xhr.status,
        data,
      } as EndpointResponse<T>);
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    // Prepare and send body
    const contentType = endpoint.contentType ?? 'application/json';
    if (options.body !== undefined) {
      if (contentType === 'multipart/form-data') {
        // Don't set Content-Type header - browser sets boundary automatically
        xhr.send(objectToFormData(options.body as Record<string, unknown>));
      } else {
        xhr.setRequestHeader('content-type', 'application/json');
        xhr.send(JSON.stringify(options.body));
      }
    } else {
      xhr.send();
    }
  });
}

/**
 * Make a request to a standard endpoint
 */
async function makeRequest<T extends StandardEndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>,
): Promise<EndpointResponse<T>> {
  // Validate request if enabled
  if (config.validateRequest !== false) {
    validateRequest(endpoint, options);
  }

  // Build URL
  let path = endpoint.path;
  if (options.params) {
    path = interpolatePath(path, options.params as Record<string, string | number>);
  }

  const url = buildUrl(
    config.baseUrl,
    path,
    options.query as Record<string, string | number | boolean | string[]> | undefined,
  );

  // Use XHR for upload progress support
  if (options.onUploadProgress && options.body !== undefined) {
    return makeRequestWithXHR(config, endpoint, options, url);
  }

  // Build headers
  const headers = new Headers(config.headers);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, String(value));
    }
  }

  // Build request init
  const init: RequestInit = {
    method: endpoint.method,
    headers,
  };

  // Add abort signal if present
  if (options.abortSignal) {
    init.signal = options.abortSignal;
  }

  // Add body if present
  if (options.body !== undefined) {
    const contentType = endpoint.contentType ?? 'application/json';

    if (contentType === 'multipart/form-data') {
      // Don't set Content-Type header - browser sets boundary automatically
      init.body = objectToFormData(options.body as Record<string, unknown>);
    } else {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(options.body);
    }
  }

  // Make request
  const response = await fetch(url, init);

  // Parse response
  let data: unknown;

  // Handle 204 No Content
  if (response.status === 204) {
    data = {};
  } else {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else {
      // Check if there's any content
      const text = await response.text();
      if (text) {
        data = text;
      } else {
        data = {};
      }
    }
  }

  // Check for HTTP errors
  if (!response.ok && !(response.status in endpoint.responses)) {
    throw new HTTPError(response.status, response.statusText, data);
  }

  // Validate response if enabled
  if (config.validateResponse !== false) {
    validateResponse(endpoint, response.status, data);
  }

  return {
    status: response.status,
    data,
  } as EndpointResponse<T>;
}

/**
 * Create a streaming result from an NDJSON response
 */
function createStreamingResult<T extends StreamingEndpointDefinition>(
  response: Response,
  controller: AbortController,
): StreamingResult<T> {
  type ChunkHandler = (chunk: ExtractChunk<T>) => void;
  type CloseHandler = (final?: ExtractFinalResponse<T>) => void;
  type ErrorHandler = (error: Error) => void;

  const listeners = {
    chunk: new Set<ChunkHandler>(),
    close: new Set<CloseHandler>(),
    error: new Set<ErrorHandler>(),
  };

  // Start reading in background
  (async () => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.__final__) {
              listeners.close.forEach((h) => h(parsed.data));
            } else {
              listeners.chunk.forEach((h) => h(parsed as ExtractChunk<T>));
            }
          } catch (parseErr) {
            listeners.error.forEach((h) => h(parseErr as Error));
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.__final__) {
            listeners.close.forEach((h) => h(parsed.data));
          } else {
            listeners.chunk.forEach((h) => h(parsed as ExtractChunk<T>));
          }
        } catch {
          // Ignore incomplete JSON at end
        }
      }

      // Stream ended without final message
      listeners.close.forEach((h) => h());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        listeners.error.forEach((h) => h(err as Error));
      }
    }
  })();

  return {
    on(event: 'chunk' | 'close' | 'error', handler: ChunkHandler | CloseHandler | ErrorHandler) {
      (listeners[event] as Set<typeof handler>).add(handler);
      return () => (listeners[event] as Set<typeof handler>).delete(handler);
    },
    abort() {
      controller.abort();
    },
    get aborted() {
      return controller.signal.aborted;
    },
  } as StreamingResult<T>;
}

/**
 * Validate streaming request data before sending
 */
function validateStreamingRequest<T extends StreamingEndpointDefinition>(
  endpoint: T,
  options: EndpointRequestOptions<T>,
): void {
  // Validate params
  if (endpoint.params && options.params) {
    const result = endpoint.params.safeParse(options.params);
    if (!result.success) {
      throw new ClientValidationError('params', result.error.issues);
    }
  }

  // Validate query
  if (endpoint.query && options.query) {
    const result = endpoint.query.safeParse(options.query);
    if (!result.success) {
      throw new ClientValidationError('query', result.error.issues);
    }
  }

  // Validate headers
  if (endpoint.headers && options.headers) {
    const result = endpoint.headers.safeParse(options.headers);
    if (!result.success) {
      throw new ClientValidationError('headers', result.error.issues);
    }
  }

  // Validate body
  if (endpoint.body && options.body) {
    const result = endpoint.body.safeParse(options.body);
    if (!result.success) {
      throw new ClientValidationError('body', result.error.issues);
    }
  }
}

/**
 * Make a streaming request to an endpoint
 */
async function makeStreamingRequest<T extends StreamingEndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>,
): Promise<StreamingResult<T>> {
  // Validate request if enabled
  if (config.validateRequest !== false) {
    validateStreamingRequest(endpoint, options);
  }

  // Build URL
  let path = endpoint.path;
  if (options.params) {
    path = interpolatePath(path, options.params as Record<string, string | number>);
  }

  const url = buildUrl(
    config.baseUrl,
    path,
    options.query as Record<string, string | number | boolean | string[]> | undefined,
  );

  // Build headers
  const headers = new Headers(config.headers);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, String(value));
    }
  }

  // Build request init - create our own controller for abort() method
  const controller = new AbortController();

  // Link to external abort signal if provided
  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      controller.abort();
    } else {
      options.abortSignal.addEventListener('abort', () => controller.abort());
    }
  }

  const init: RequestInit = {
    method: endpoint.method,
    headers,
    signal: controller.signal,
  };

  // Add body if present
  if (options.body !== undefined) {
    const contentType = endpoint.contentType ?? 'application/json';

    if (contentType === 'multipart/form-data') {
      init.body = objectToFormData(options.body as Record<string, unknown>);
    } else {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(options.body);
    }
  }

  // Make request
  const response = await fetch(url, init);

  // Check for error responses before streaming
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    throw new HTTPError(response.status, response.statusText, data);
  }

  // Return streaming result
  return createStreamingResult<T>(response, controller);
}

/**
 * Create an SSE connection
 */
function createSSEConnection<T extends SSEEndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: Omit<EndpointRequestOptions<T>, 'body' | 'onUploadProgress'> = {},
): SSEConnection<T> {
  // Build URL
  let path = endpoint.path;
  if (options.params) {
    path = interpolatePath(path, options.params as Record<string, string | number>);
  }

  const url = buildUrl(
    config.baseUrl,
    path,
    options.query as Record<string, string | number | boolean | string[]> | undefined,
  );

  // EventSource doesn't support custom headers, but we can include query params
  // Note: If auth headers are needed, consider using fetch-based SSE or passing auth in query
  const eventSource = new EventSource(url);

  type EventHandler = (data: unknown, id?: string) => void;
  type ErrorHandler = (error: Error) => void;

  const listeners: Record<string, Set<EventHandler | ErrorHandler>> = {
    error: new Set<ErrorHandler>(),
  };

  // Get event names from the endpoint
  const eventNames = Object.keys(endpoint.events);

  // Register listeners for each event type
  for (const eventName of eventNames) {
    listeners[eventName] = new Set<EventHandler>();
    eventSource.addEventListener(eventName, (e) => {
      const messageEvent = e as MessageEvent;
      try {
        const data = JSON.parse(messageEvent.data);
        (listeners[eventName] as Set<EventHandler>).forEach((h) =>
          h(data, messageEvent.lastEventId || undefined),
        );
      } catch (err) {
        (listeners.error as Set<ErrorHandler>).forEach((h) =>
          h(new Error(`Failed to parse SSE data: ${(err as Error).message}`)),
        );
      }
    });
  }

  // Handle errors
  eventSource.onerror = () => {
    (listeners.error as Set<ErrorHandler>).forEach((h) => h(new Error('SSE connection error')));
  };

  return {
    on(event: string, handler: EventHandler | ErrorHandler) {
      if (!listeners[event]) {
        listeners[event] = new Set();
      }
      (listeners[event] as Set<typeof handler>).add(handler);
      return () => (listeners[event] as Set<typeof handler>).delete(handler);
    },
    close() {
      eventSource.close();
    },
    get state() {
      const states = ['connecting', 'open', 'closed'] as const;
      return states[eventSource.readyState];
    },
  } as SSEConnection<T>;
}

/**
 * Resolve relative baseUrl to absolute URL in browser contexts
 */
function resolveBaseUrl(baseUrl: string): string {
  // If baseUrl is already absolute, return as-is
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl;
  }

  // If baseUrl is relative (starts with /), resolve it using window.location in browser
  if (baseUrl.startsWith('/')) {
    const g = globalThis as unknown as { location?: { origin?: string } };
    const origin = g?.location?.origin || 'http://localhost';
    return origin + baseUrl;
  }

  // Otherwise, assume it's a full URL
  return baseUrl;
}

/**
 * Create a typesafe client for a contract
 */
export function createClient<T extends Contract>(contract: T, config: ClientConfig): Client<T> {
  // Resolve relative baseUrl to absolute URL
  const resolvedConfig = {
    ...config,
    baseUrl: resolveBaseUrl(config.baseUrl),
  };

  const client: Record<string, unknown> = {};

  for (const [name, endpoint] of Object.entries(contract)) {
    if (endpoint.type === 'standard') {
      client[name] = (options: EndpointRequestOptions<StandardEndpointDefinition> = {}) => {
        return makeRequest(resolvedConfig, endpoint, options);
      };
    } else if (endpoint.type === 'streaming') {
      client[name] = (options: EndpointRequestOptions<StreamingEndpointDefinition> = {}) => {
        return makeStreamingRequest(resolvedConfig, endpoint, options);
      };
    } else if (endpoint.type === 'sse') {
      client[name] = (
        options: Omit<
          EndpointRequestOptions<SSEEndpointDefinition>,
          'body' | 'onUploadProgress'
        > = {},
      ) => {
        return createSSEConnection(resolvedConfig, endpoint, options);
      };
    } else if (endpoint.type === 'download') {
      client[name] = (options: DownloadRequestOptions<DownloadEndpointDefinition> = {}) => {
        return makeDownloadRequest(resolvedConfig, endpoint, options);
      };
    } else {
      throw new Error(`Endpoint "${name}" has unknown type "${(endpoint as any).type}".`);
    }
  }

  return client as Client<T>;
}

/**
 * Create a client without providing the contract at runtime
 * Useful when you only need types and want a lighter bundle
 */
export function createTypedClient<T extends Contract>(_config: ClientConfig): Client<T> {
  return new Proxy({} as Client<T>, {
    get(_target, _prop: string) {
      return async (_options: EndpointRequestOptions<EndpointDefinition> = {}) => {
        // Without the contract, we can't validate or infer the endpoint
        // This is just a basic fetch wrapper with typing
        throw new Error(
          'createTypedClient requires contract at runtime for validation. Use createClient instead.',
        );
      };
    },
  });
}
