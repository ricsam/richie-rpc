import type {
  Client,
  ClientMethod,
  EndpointRequestOptions,
  EndpointResponse,
} from '@richie-rpc/client';
import type { Contract, EndpointDefinition } from '@richie-rpc/core';
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
export type QueryHook<T extends EndpointDefinition> = {
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
export type MutationHook<T extends EndpointDefinition> = {
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
export type EndpointHook<T extends EndpointDefinition> = T['method'] extends QueryMethods
  ? QueryHook<T>
  : T['method'] extends MutationMethods
    ? MutationHook<T>
    : never;

/**
 * Complete hooks object for a contract
 * Each endpoint gets appropriate hooks based on its HTTP method
 */
export type Hooks<T extends Contract> = {
  [K in keyof T]: EndpointHook<T[K]>;
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
    const method = endpoint.method;
    const clientMethod = client[name as keyof T] as unknown as ClientMethod<EndpointDefinition>;

    if (method === 'GET' || method === 'HEAD') {
      // Create query hooks for read operations
      hooks[name] = {
        useQuery: (
          options: EndpointRequestOptions<EndpointDefinition>,
          queryOptions?: Omit<
            UseQueryOptions<EndpointResponse<EndpointDefinition>, Error>,
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
          options: EndpointRequestOptions<EndpointDefinition>,
          queryOptions?: Omit<
            UseSuspenseQueryOptions<EndpointResponse<EndpointDefinition>, Error>,
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
              EndpointResponse<EndpointDefinition>,
              Error,
              EndpointRequestOptions<EndpointDefinition>
            >,
            'mutationFn'
          >,
        ) => {
          return useMutation({
            mutationFn: (options: EndpointRequestOptions<EndpointDefinition>) =>
              clientMethod(options),
            ...mutationOptions,
          });
        },
      };
    }
  }

  return hooks as Hooks<T>;
}
