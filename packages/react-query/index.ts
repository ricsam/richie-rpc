import type {
  Client,
  ClientMethod,
  EndpointRequestOptions,
  EndpointResponse,
  SSEClientMethod,
  StreamingClientMethod,
} from '@richie-rpc/client';
import type {
  Contract,
  SSEEndpointDefinition,
  StandardEndpointDefinition,
  StreamingEndpointDefinition,
} from '@richie-rpc/core';
import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';

// HTTP methods that should use query hooks (read operations)
type QueryMethods = 'GET' | 'HEAD';

// HTTP methods that should use mutation hooks (write operations)
type MutationMethods = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

/**
 * Hook wrapper for query endpoints (GET, HEAD)
 * Provides useQuery and useSuspenseQuery methods
 */
export type QueryHook<T extends StandardEndpointDefinition> = {
  /**
   * Standard query hook that returns loading states
   */
  useQuery: (
    options: EndpointRequestOptions<T>,
    queryOptions?: Omit<UseQueryOptions<EndpointResponse<T>, Error>, 'queryKey' | 'queryFn'>,
  ) => UseQueryResult<EndpointResponse<T>, Error>;

  /**
   * Suspense-enabled query hook that throws promises for React Suspense
   */
  useSuspenseQuery: (
    options: EndpointRequestOptions<T>,
    queryOptions?: Omit<
      UseSuspenseQueryOptions<EndpointResponse<T>, Error>,
      'queryKey' | 'queryFn'
    >,
  ) => UseSuspenseQueryResult<EndpointResponse<T>, Error>;
};

/**
 * Hook wrapper for mutation endpoints (POST, PUT, PATCH, DELETE)
 * Provides useMutation method
 */
export type MutationHook<T extends StandardEndpointDefinition> = {
  /**
   * Mutation hook for write operations
   */
  useMutation: (
    mutationOptions?: Omit<
      UseMutationOptions<EndpointResponse<T>, Error, EndpointRequestOptions<T>>,
      'mutationFn'
    >,
  ) => UseMutationResult<EndpointResponse<T>, Error, EndpointRequestOptions<T>>;
};

/**
 * Conditionally apply hook type based on HTTP method
 */
export type EndpointHook<T extends StandardEndpointDefinition> = T['method'] extends QueryMethods
  ? QueryHook<T>
  : T['method'] extends MutationMethods
    ? MutationHook<T>
    : never;

/**
 * Hook wrapper for streaming endpoints
 * Exposes the streaming client method directly since React Query
 * doesn't fit well with long-lived streaming connections
 */
export type StreamingHook<T extends StreamingEndpointDefinition> = {
  /**
   * Start a streaming request
   */
  stream: StreamingClientMethod<T>;
};

/**
 * Hook wrapper for SSE endpoints
 * Exposes the SSE client method directly since React Query
 * doesn't fit well with long-lived SSE connections
 */
export type SSEHook<T extends SSEEndpointDefinition> = {
  /**
   * Create an SSE connection
   */
  connect: SSEClientMethod<T>;
};

/**
 * Complete hooks object for a contract
 * Each endpoint gets appropriate hooks based on its type and HTTP method
 */
export type Hooks<T extends Contract> = {
  [K in keyof T]: T[K] extends StandardEndpointDefinition
    ? EndpointHook<T[K]>
    : T[K] extends StreamingEndpointDefinition
      ? StreamingHook<T[K]>
      : T[K] extends SSEEndpointDefinition
        ? SSEHook<T[K]>
        : never;
};

/**
 * Create typed React hooks for all endpoints in a contract
 *
 * Query endpoints (GET, HEAD) get useQuery and useSuspenseQuery methods
 * Mutation endpoints (POST, PUT, PATCH, DELETE) get useMutation method
 *
 * @param client - The typed client created with createClient()
 * @param contract - The contract definition
 * @returns Hooks object with methods for each endpoint
 *
 * @example
 * ```tsx
 * const client = createClient(contract, { baseUrl: 'http://localhost:3000' });
 * const hooks = createHooks(client, contract);
 *
 * // In a component - Query
 * function UserList() {
 *   const { data, isLoading } = hooks.listUsers.useQuery({
 *     query: { limit: "10" }
 *   });
 *   // ...
 * }
 *
 * // In a component - Mutation
 * function CreateUser() {
 *   const mutation = hooks.createUser.useMutation();
 *   return (
 *     <button onClick={() => mutation.mutate({
 *       body: { name: "Alice", email: "alice@example.com" }
 *     })}>
 *       Create User
 *     </button>
 *   );
 * }
 * ```
 */
export function createHooks<T extends Contract>(client: Client<T>, contract: T): Hooks<T> {
  const hooks: Record<string, unknown> = {};

  for (const [name, endpoint] of Object.entries(contract)) {
    // Handle streaming endpoints
    if (endpoint.type === 'streaming') {
      const streamMethod = client[name as keyof T] as unknown as StreamingClientMethod<StreamingEndpointDefinition>;
      hooks[name] = {
        stream: streamMethod,
      };
      continue;
    }

    // Handle SSE endpoints
    if (endpoint.type === 'sse') {
      const connectMethod = client[name as keyof T] as unknown as SSEClientMethod<SSEEndpointDefinition>;
      hooks[name] = {
        connect: connectMethod,
      };
      continue;
    }

    // Handle standard endpoints
    const method = endpoint.method;
    const clientMethod = client[name as keyof T] as unknown as ClientMethod<StandardEndpointDefinition>;

    if (method === 'GET' || method === 'HEAD') {
      // Create query hooks for read operations
      hooks[name] = {
        useQuery: (
          options: EndpointRequestOptions<StandardEndpointDefinition>,
          queryOptions?: Omit<
            UseQueryOptions<EndpointResponse<StandardEndpointDefinition>, Error>,
            'queryKey' | 'queryFn'
          >,
        ) => {
          return useQuery({
            queryKey: [
              name,
              options.params ?? null,
              options.query ?? null,
              options.headers ?? null,
              options.body ?? null,
            ],
            queryFn: () => clientMethod(options),
            ...queryOptions,
          });
        },
        useSuspenseQuery: (
          options: EndpointRequestOptions<StandardEndpointDefinition>,
          queryOptions?: Omit<
            UseSuspenseQueryOptions<EndpointResponse<StandardEndpointDefinition>, Error>,
            'queryKey' | 'queryFn'
          >,
        ) => {
          return useSuspenseQuery({
            queryKey: [
              name,
              options.params ?? null,
              options.query ?? null,
              options.headers ?? null,
              options.body ?? null,
            ],
            queryFn: () => clientMethod(options),
            ...queryOptions,
          });
        },
      };
    } else {
      // Create mutation hooks for write operations
      hooks[name] = {
        useMutation: (
          mutationOptions?: Omit<
            UseMutationOptions<
              EndpointResponse<StandardEndpointDefinition>,
              Error,
              EndpointRequestOptions<StandardEndpointDefinition>
            >,
            'mutationFn'
          >,
        ) => {
          return useMutation({
            mutationFn: (options: EndpointRequestOptions<StandardEndpointDefinition>) =>
              clientMethod(options),
            ...mutationOptions,
          });
        },
      };
    }
  }

  return hooks as Hooks<T>;
}
