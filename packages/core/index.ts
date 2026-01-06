import type { z } from 'zod';

// HTTP methods supported
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Content types supported for request bodies
export type ContentType = 'application/json' | 'multipart/form-data';

// HTTP status codes as const object for type-safe responses without 'as const'
export const Status = {
  // Success responses
  OK: 200 as const,
  Created: 201 as const,
  Accepted: 202 as const,
  NoContent: 204 as const,

  // Redirection
  MovedPermanently: 301 as const,
  Found: 302 as const,
  NotModified: 304 as const,

  // Client errors
  BadRequest: 400 as const,
  Unauthorized: 401 as const,
  Forbidden: 403 as const,
  NotFound: 404 as const,
  MethodNotAllowed: 405 as const,
  Conflict: 409 as const,
  UnprocessableEntity: 422 as const,
  TooManyRequests: 429 as const,

  // Server errors
  InternalServerError: 500 as const,
  NotImplemented: 501 as const,
  BadGateway: 502 as const,
  ServiceUnavailable: 503 as const,
  GatewayTimeout: 504 as const,
} as const;

// Base fields shared by all endpoint types
interface BaseEndpointFields {
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  headers?: z.ZodTypeAny;
}

// Standard HTTP endpoint
export interface StandardEndpointDefinition extends BaseEndpointFields {
  type: 'standard';
  method: HttpMethod;
  body?: z.ZodTypeAny;
  contentType?: ContentType;
  responses: Record<number, z.ZodTypeAny>;
}

// Streaming response endpoint (NDJSON)
export interface StreamingEndpointDefinition extends BaseEndpointFields {
  type: 'streaming';
  method: 'POST';
  body?: z.ZodTypeAny;
  contentType?: ContentType;
  /** Schema for each NDJSON chunk (type inference only, not validated) */
  chunk: z.ZodTypeAny;
  /** Optional final response after stream ends */
  finalResponse?: z.ZodTypeAny;
  /** Error responses for non-streaming failures */
  errorResponses?: Record<number, z.ZodTypeAny>;
}

// SSE endpoint
export interface SSEEndpointDefinition extends BaseEndpointFields {
  type: 'sse';
  method: 'GET';
  /** Event types: key = event name, value = data schema (type inference only) */
  events: Record<string, z.ZodTypeAny>;
  /** Error responses for connection failures */
  errorResponses?: Record<number, z.ZodTypeAny>;
}

// Download endpoint (binary file response)
export interface DownloadEndpointDefinition extends BaseEndpointFields {
  type: 'download';
  method: 'GET'; // Downloads are GET-only
  /** Error responses (non-2xx status codes) */
  errorResponses?: Record<number, z.ZodTypeAny>;
}

// Union of all endpoint types
export type AnyEndpointDefinition =
  | StandardEndpointDefinition
  | StreamingEndpointDefinition
  | SSEEndpointDefinition
  | DownloadEndpointDefinition;

// Alias for backwards compatibility in type utilities
export type EndpointDefinition = AnyEndpointDefinition;

// Contract is a collection of named endpoints
export type Contract = Record<string, AnyEndpointDefinition>;

// Extract the Zod type from a schema
export type InferZodType<T> = T extends z.ZodTypeAny ? z.infer<T> : never;

// Extract params type from endpoint
export type ExtractParams<T extends EndpointDefinition> = T['params'] extends z.ZodTypeAny
  ? InferZodType<T['params']>
  : never;

// Extract query type from endpoint
export type ExtractQuery<T extends EndpointDefinition> = T['query'] extends z.ZodTypeAny
  ? InferZodType<T['query']>
  : never;

// Extract headers type from endpoint
export type ExtractHeaders<T extends EndpointDefinition> = T['headers'] extends z.ZodTypeAny
  ? InferZodType<T['headers']>
  : never;

// Extract body type from endpoint (only standard and streaming have body)
export type ExtractBody<T extends EndpointDefinition> = T extends { body: z.ZodTypeAny }
  ? InferZodType<T['body']>
  : never;

// Extract response types for all status codes (only standard has responses)
export type ExtractResponses<T extends EndpointDefinition> = T extends {
  responses: Record<number, z.ZodTypeAny>;
}
  ? {
      [K in keyof T['responses']]: T['responses'][K] extends z.ZodTypeAny
        ? InferZodType<T['responses'][K]>
        : never;
    }
  : never;

// Extract a specific response type by status code (only standard has responses)
export type ExtractResponse<T extends EndpointDefinition, Status extends number> = T extends {
  responses: Record<number, z.ZodTypeAny>;
}
  ? Status extends keyof T['responses']
    ? T['responses'][Status] extends z.ZodTypeAny
      ? InferZodType<T['responses'][Status]>
      : never
    : never
  : never;

// Extract chunk type from streaming endpoint
export type ExtractChunk<T extends StreamingEndpointDefinition> = T['chunk'] extends z.ZodTypeAny
  ? InferZodType<T['chunk']>
  : never;

// Extract final response type from streaming endpoint
export type ExtractFinalResponse<T extends StreamingEndpointDefinition> =
  T['finalResponse'] extends z.ZodTypeAny ? InferZodType<T['finalResponse']> : undefined;

// Extract SSE event union type
export type ExtractSSEEvents<T extends SSEEndpointDefinition> = {
  [K in keyof T['events']]: {
    event: K;
    data: T['events'][K] extends z.ZodTypeAny ? InferZodType<T['events'][K]> : never;
    id?: string;
  };
}[keyof T['events']];

// Extract specific SSE event data type
export type ExtractSSEEventData<
  T extends SSEEndpointDefinition,
  K extends keyof T['events'],
> = T['events'][K] extends z.ZodTypeAny ? InferZodType<T['events'][K]> : never;

// Extract error responses for download endpoint
export type ExtractDownloadErrorResponse<
  T extends DownloadEndpointDefinition,
  Status extends keyof T['errorResponses'],
> =
  T['errorResponses'] extends Record<number, z.ZodTypeAny>
    ? Status extends keyof T['errorResponses']
      ? T['errorResponses'][Status] extends z.ZodTypeAny
        ? InferZodType<T['errorResponses'][Status]>
        : never
      : never
    : never;

// Upload progress event
export interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number; // 0-1 (percentage as decimal)
}

// Download progress event
export interface DownloadProgressEvent {
  loaded: number;
  total: number;
  progress: number; // 0-1 (percentage as decimal), NaN if total unknown
}

// Path parameter extraction utilities
export type ExtractPathParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
      ? Param
      : never;

// Convert path params to object type
export type PathParamsObject<T extends string> = {
  [K in ExtractPathParams<T>]: string;
};

/**
 * Parse path parameters from a URL path pattern
 * e.g., "/users/:id/posts/:postId" => ["id", "postId"]
 */
export function parsePathParams(path: string): string[] {
  const matches = path.match(/:([^/]+)/g);
  if (!matches) return [];
  return matches.map((match) => match.slice(1));
}

/**
 * Match a URL path against a pattern and extract parameters
 * e.g., matchPath("/users/:id", "/users/123") => { id: "123" }
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const paramNames = parsePathParams(pattern);

  // Convert pattern to regex
  const regexPattern = pattern.replace(/:[^/]+/g, '([^/]+)').replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1] ?? '';
  });

  return params;
}

/**
 * Interpolate path parameters into a URL pattern
 * e.g., interpolatePath("/users/:id", { id: "123" }) => "/users/123"
 */
export function interpolatePath(pattern: string, params: Record<string, string | number>): string {
  let result = pattern;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, String(value));
  }
  return result;
}

/**
 * Build a complete URL with query parameters
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | string[]>,
): string {
  // Normalize baseUrl - remove trailing slash
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Concatenate base and path
  const fullPath = normalizedBase + normalizedPath;

  const url = new URL(fullPath);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, String(v));
          }
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }
  }

  return url.toString();
}

/**
 * Parse query parameters from URLSearchParams
 */
export function parseQuery(searchParams: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const existing = result[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Type helper to ensure a value is a valid contract
export function defineContract<T extends Contract>(contract: T): T {
  return contract;
}

/**
 * Convert an object to FormData using the hybrid JSON + Files approach.
 * Files are extracted and replaced with { __fileRef__: "path" } placeholders.
 * The resulting FormData contains __json__ with the serialized structure
 * and individual file entries at their path keys.
 */
export function objectToFormData(obj: Record<string, unknown>): FormData {
  const formData = new FormData();
  const files: Array<{ path: string; file: File }> = [];

  function traverse(value: unknown, path: string): unknown {
    if (value instanceof File) {
      files.push({ path, file: value });
      return { __fileRef__: path };
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => traverse(item, `${path}.${i}`));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = traverse(v, path ? `${path}.${k}` : k);
      }
      return result;
    }
    return value;
  }

  const jsonWithRefs = traverse(obj, '');
  formData.append('__json__', JSON.stringify(jsonWithRefs));

  for (const { path, file } of files) {
    formData.append(path, file);
  }

  return formData;
}

/**
 * Parse FormData back to an object, reconstructing the structure with File objects.
 * Expects FormData created by objectToFormData with __json__ and file entries.
 * Falls back to simple Object.fromEntries for FormData without __json__.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const jsonStr = formData.get('__json__');
  if (typeof jsonStr !== 'string') {
    return Object.fromEntries(formData.entries());
  }

  const obj = JSON.parse(jsonStr);

  function replaceRefs(value: unknown): unknown {
    if (value && typeof value === 'object' && '__fileRef__' in value) {
      const path = (value as { __fileRef__: string }).__fileRef__;
      return formData.get(path);
    }
    if (Array.isArray(value)) {
      return value.map(replaceRefs);
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = replaceRefs(v);
      }
      return result;
    }
    return value;
  }

  return replaceRefs(obj) as Record<string, unknown>;
}

// Re-export WebSocket types
export * from './websocket';
