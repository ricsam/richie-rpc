import type {
  Contract,
  EndpointDefinition,
  ExtractParams,
  ExtractQuery,
  ExtractHeaders,
  ExtractBody,
  ExtractResponses
} from '@rfetch/core';
import { interpolatePath, buildUrl } from '@rfetch/core';
import { z } from 'zod';

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
};

// Response type for an endpoint (union of all possible responses)
export type EndpointResponse<T extends EndpointDefinition> = {
  [Status in keyof T['responses']]: {
    status: Status;
    data: T['responses'][Status] extends z.ZodTypeAny
      ? z.infer<T['responses'][Status]>
      : never;
  };
}[keyof T['responses']];

// Client method type for an endpoint
export type ClientMethod<T extends EndpointDefinition> = (
  options: EndpointRequestOptions<T>
) => Promise<EndpointResponse<T>>;

// Client type for a contract
export type Client<T extends Contract> = {
  [K in keyof T]: ClientMethod<T[K]>;
};

// Validation error
export class ClientValidationError extends Error {
  constructor(
    public field: string,
    public issues: z.ZodIssue[]
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
    public body: any
  ) {
    super(`HTTP Error ${status}: ${statusText}`);
    this.name = 'HTTPError';
  }
}

/**
 * Validate request data before sending
 */
function validateRequest<T extends EndpointDefinition>(
  endpoint: T,
  options: EndpointRequestOptions<T>
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
function validateResponse<T extends EndpointDefinition>(
  endpoint: T,
  status: number,
  data: any
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
 * Make a request to an endpoint
 */
async function makeRequest<T extends EndpointDefinition>(
  config: ClientConfig,
  endpoint: T,
  options: EndpointRequestOptions<T>
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
    options.query as Record<string, any> | undefined
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
    method: endpoint.method,
    headers
  };
  
  // Add body if present
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  
  // Make request
  const response = await fetch(url, init);
  
  // Parse response
  let data: any;
  
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
    data
  } as EndpointResponse<T>;
}

/**
 * Create a typesafe client for a contract
 */
export function createClient<T extends Contract>(
  contract: T,
  config: ClientConfig
): Client<T> {
  const client: any = {};
  
  for (const [name, endpoint] of Object.entries(contract)) {
    client[name] = (options: EndpointRequestOptions<any> = {}) => {
      return makeRequest(config, endpoint, options);
    };
  }
  
  return client as Client<T>;
}

/**
 * Create a client without providing the contract at runtime
 * Useful when you only need types and want a lighter bundle
 */
export function createTypedClient<T extends Contract>(
  config: ClientConfig
): Client<T> {
  return new Proxy({} as Client<T>, {
    get(_target, prop: string) {
      return async (options: any = {}) => {
        // Without the contract, we can't validate or infer the endpoint
        // This is just a basic fetch wrapper with typing
        throw new Error(
          'createTypedClient requires contract at runtime for validation. Use createClient instead.'
        );
      };
    }
  });
}

