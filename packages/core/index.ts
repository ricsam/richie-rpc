import type { z } from 'zod';

// HTTP methods supported
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

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

// Endpoint definition structure
export interface EndpointDefinition {
  method: HttpMethod;
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  headers?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  responses: Record<number, z.ZodTypeAny>;
}

// Contract is a collection of named endpoints
export type Contract = Record<string, EndpointDefinition>;

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

// Extract body type from endpoint
export type ExtractBody<T extends EndpointDefinition> = T['body'] extends z.ZodTypeAny
  ? InferZodType<T['body']>
  : never;

// Extract response types for all status codes
export type ExtractResponses<T extends EndpointDefinition> = {
  [K in keyof T['responses']]: T['responses'][K] extends z.ZodTypeAny
    ? InferZodType<T['responses'][K]>
    : never;
};

// Extract a specific response type by status code
export type ExtractResponse<
  T extends EndpointDefinition,
  Status extends number,
> = Status extends keyof T['responses']
  ? T['responses'][Status] extends z.ZodTypeAny
    ? InferZodType<T['responses'][Status]>
    : never
  : never;

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
  const url = new URL(path, baseUrl);

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
