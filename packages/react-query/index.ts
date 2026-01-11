/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Client,
  ClientMethod,
  DownloadClientMethod,
  EndpointRequestOptions,
  EndpointResponse,
  SSEClientMethod,
  StreamingClientMethod,
} from '@richie-rpc/client';
import type {
  Contract,
  DownloadEndpointDefinition,
  ExtractChunk,
  SSEEndpointDefinition,
  StandardEndpointDefinition,
  StreamingEndpointDefinition,
} from '@richie-rpc/core';
import {
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  type Updater,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseInfiniteQueryOptions,
  type UseSuspenseInfiniteQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
  experimental_streamedQuery as streamedQuery,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';

// ============================================
// HTTP Method Categories
// ============================================

type QueryMethods = 'GET' | 'HEAD';
type MutationMethods = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

// ============================================
// Query Options Types (ts-rest style)
// ============================================

/**
 * Unified query options - combines queryKey, queryData, and TanStack Query options
 */
export type TsrQueryOptions<T extends StandardEndpointDefinition> = Omit<
  UseQueryOptions<EndpointResponse<T>, Error>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryData: EndpointRequestOptions<T>;
};

/**
 * Suspense query options
 */
export type TsrSuspenseQueryOptions<T extends StandardEndpointDefinition> = Omit<
  UseSuspenseQueryOptions<EndpointResponse<T>, Error>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryData: EndpointRequestOptions<T>;
};

/**
 * Infinite query options - queryData is a function that receives pageParam
 */
export type TsrInfiniteQueryOptions<
  T extends StandardEndpointDefinition,
  TPageParam = unknown,
> = Omit<
  UseInfiniteQueryOptions<EndpointResponse<T>, Error, unknown, QueryKey, TPageParam>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryData: (context: { pageParam: TPageParam }) => EndpointRequestOptions<T>;
};

/**
 * Suspense infinite query options
 */
export type TsrSuspenseInfiniteQueryOptions<
  T extends StandardEndpointDefinition,
  TPageParam = unknown,
> = Omit<
  UseSuspenseInfiniteQueryOptions<EndpointResponse<T>, Error, unknown, QueryKey, TPageParam>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryData: (context: { pageParam: TPageParam }) => EndpointRequestOptions<T>;
};

/**
 * Mutation options - same as TanStack Query but typed
 */
export type TsrMutationOptions<T extends StandardEndpointDefinition> = Omit<
  UseMutationOptions<EndpointResponse<T>, Error, EndpointRequestOptions<T>>,
  'mutationFn'
>;

/**
 * Stream query options for streaming endpoints
 */
export type TsrStreamQueryOptions<T extends StreamingEndpointDefinition> = Omit<
  UseQueryOptions<ExtractChunk<T>[], Error>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryData: EndpointRequestOptions<T>;
  refetchMode?: 'reset' | 'append' | 'replace';
};

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Response type from hooks - includes status and body like ts-rest
 */
export type TsrResponse<T extends StandardEndpointDefinition> = EndpointResponse<T>;

/**
 * Error response type - either fetch error or typed response error
 */
export type TsrError =
  | Error
  | {
      status: number;
      data: unknown;
    };

/**
 * Check if an error is a fetch/network error (Error instance, not a response)
 */
export function isFetchError(error: unknown): error is Error {
  return error instanceof Error && !('status' in error);
}

/**
 * Check if error is a response with a status code not defined in the contract
 */
export function isUnknownErrorResponse<T extends StandardEndpointDefinition>(
  error: unknown,
  endpoint: T,
): error is { status: number; data: unknown } {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false;
  }
  const status = (error as { status: number }).status;
  return !(status in endpoint.responses);
}

/**
 * Check if error is either a fetch error or unknown response error
 */
export function isNotKnownResponseError<T extends StandardEndpointDefinition>(
  error: unknown,
  endpoint: T,
): error is Error | { status: number; data: unknown } {
  return isFetchError(error) || isUnknownErrorResponse(error, endpoint);
}

/**
 * Exhaustive guard for compile-time exhaustiveness checking
 * Use after handling all known error cases to ensure nothing is missed
 */
export function exhaustiveGuard(_value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(_value)}`);
}

// ============================================
// Typed QueryClient Types
// ============================================

/**
 * Typed query client methods for a single query endpoint
 */
export type TypedQueryEndpointClient<T extends StandardEndpointDefinition> = {
  getQueryData: (queryKey: QueryKey) => EndpointResponse<T> | undefined;
  setQueryData: (
    queryKey: QueryKey,
    updater: Updater<EndpointResponse<T> | undefined, EndpointResponse<T> | undefined>,
  ) => EndpointResponse<T> | undefined;
  getQueryState: (queryKey: QueryKey) => ReturnType<QueryClient['getQueryState']>;
  fetchQuery: (options: TsrQueryOptions<T>) => Promise<EndpointResponse<T>>;
  prefetchQuery: (options: TsrQueryOptions<T>) => Promise<void>;
  ensureQueryData: (options: TsrQueryOptions<T>) => Promise<EndpointResponse<T>>;
};

/**
 * Typed query client methods for a single mutation endpoint
 * Mutations don't have query-specific cache methods
 */
export type TypedMutationEndpointClient<_T extends StandardEndpointDefinition> = object;

/**
 * Full typed query client - extends QueryClient with per-endpoint methods
 */
export type TypedQueryClient<T extends Contract> = QueryClient & {
  [K in keyof T]: T[K] extends StandardEndpointDefinition
    ? T[K]['method'] extends QueryMethods
      ? TypedQueryEndpointClient<T[K]>
      : TypedMutationEndpointClient<T[K]>
    : Record<string, never>;
};

// ============================================
// Endpoint API Types
// ============================================

/**
 * API for query endpoints (GET, HEAD)
 */
export type QueryEndpointApi<T extends StandardEndpointDefinition> = {
  /** Standard query hook */
  useQuery: (options: TsrQueryOptions<T>) => UseQueryResult<EndpointResponse<T>, Error> & {
    contractEndpoint: T;
  };
  /** Suspense query hook */
  useSuspenseQuery: (options: TsrSuspenseQueryOptions<T>) => UseSuspenseQueryResult<
    EndpointResponse<T>,
    Error
  > & {
    contractEndpoint: T;
  };
  /** Infinite query hook */
  useInfiniteQuery: <TPageParam = unknown>(
    options: TsrInfiniteQueryOptions<T, TPageParam>,
  ) => UseInfiniteQueryResult<InfiniteData<EndpointResponse<T>, TPageParam>, Error> & {
    contractEndpoint: T;
  };
  /** Suspense infinite query hook */
  useSuspenseInfiniteQuery: <TPageParam = unknown>(
    options: TsrSuspenseInfiniteQueryOptions<T, TPageParam>,
  ) => UseSuspenseInfiniteQueryResult<InfiniteData<EndpointResponse<T>, TPageParam>, Error> & {
    contractEndpoint: T;
  };
  /** Direct fetch without React Query */
  query: (options: EndpointRequestOptions<T>) => Promise<EndpointResponse<T>>;
};

/**
 * API for mutation endpoints (POST, PUT, PATCH, DELETE)
 */
export type MutationEndpointApi<T extends StandardEndpointDefinition> = {
  /** Mutation hook */
  useMutation: (options?: TsrMutationOptions<T>) => UseMutationResult<
    EndpointResponse<T>,
    Error,
    EndpointRequestOptions<T>
  > & {
    contractEndpoint: T;
  };
  /** Direct mutate without React Query */
  mutate: (options: EndpointRequestOptions<T>) => Promise<EndpointResponse<T>>;
};

/**
 * API for streaming endpoints
 */
export type StreamingEndpointApi<T extends StreamingEndpointDefinition> = {
  /** Direct stream access (event-based) */
  stream: StreamingClientMethod<T>;
  /** Query hook using experimental streamedQuery */
  useStreamQuery: (options: TsrStreamQueryOptions<T>) => UseQueryResult<
    ExtractChunk<T>[],
    Error
  > & {
    contractEndpoint: T;
  };
};

/**
 * API for SSE endpoints
 */
export type SSEEndpointApi<T extends SSEEndpointDefinition> = {
  /** Direct SSE connection access (event-based) */
  connect: SSEClientMethod<T>;
};

/**
 * API for download endpoints
 */
export type DownloadEndpointApi<T extends DownloadEndpointDefinition> = {
  /** Direct download without React Query */
  download: DownloadClientMethod<T>;
};

/**
 * Select appropriate API type based on endpoint type
 */
export type EndpointApi<T> = T extends StandardEndpointDefinition
  ? T['method'] extends QueryMethods
    ? QueryEndpointApi<T>
    : T['method'] extends MutationMethods
      ? MutationEndpointApi<T>
      : never
  : T extends StreamingEndpointDefinition
    ? StreamingEndpointApi<T>
    : T extends SSEEndpointDefinition
      ? SSEEndpointApi<T>
      : T extends DownloadEndpointDefinition
        ? DownloadEndpointApi<T>
        : never;

// ============================================
// Main TanStack Query API Type
// ============================================

/**
 * Full TanStack Query API for a contract
 */
export type TanstackQueryApi<T extends Contract> = {
  [K in keyof T]: EndpointApi<T[K]>;
};

// ============================================
// Async Iterator Adapter for Streaming
// ============================================

/**
 * Convert StreamingResult to an AsyncIterable for use with streamedQuery
 */
function streamToAsyncIterable<T extends StreamingEndpointDefinition>(
  streamingMethod: StreamingClientMethod<T>,
  options: EndpointRequestOptions<T>,
): () => Promise<AsyncIterable<ExtractChunk<T>>> {
  return async () => {
    const result = await streamingMethod(options);

    return {
      [Symbol.asyncIterator](): AsyncIterator<ExtractChunk<T>> {
        let resolveNext: ((value: IteratorResult<ExtractChunk<T>>) => void) | null = null;
        let rejectNext: ((error: Error) => void) | null = null;
        const queue: ExtractChunk<T>[] = [];
        let done = false;
        let error: Error | null = null;

        result.on('chunk', (chunk) => {
          if (resolveNext) {
            resolveNext({ value: chunk, done: false });
            resolveNext = null;
            rejectNext = null;
          } else {
            queue.push(chunk);
          }
        });

        result.on('close', () => {
          done = true;
          if (resolveNext) {
            resolveNext({ value: undefined as any, done: true });
            resolveNext = null;
            rejectNext = null;
          }
        });

        result.on('error', (err) => {
          error = err;
          done = true;
          if (rejectNext) {
            rejectNext(err);
            resolveNext = null;
            rejectNext = null;
          }
        });

        return {
          next(): Promise<IteratorResult<ExtractChunk<T>>> {
            if (error) {
              return Promise.reject(error);
            }
            if (queue.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              return Promise.resolve({ value: queue.shift()!, done: false });
            }
            if (done) {
              return Promise.resolve({ value: undefined as any, done: true });
            }
            return new Promise((resolve, reject) => {
              resolveNext = resolve;
              rejectNext = reject;
            });
          },
        };
      },
    };
  };
}

// ============================================
// Create Typed QueryClient
// ============================================

/**
 * Create a typed QueryClient wrapper with per-endpoint cache methods
 *
 * @param queryClient - The TanStack QueryClient instance
 * @param client - The typed client created with createClient()
 * @param contract - The contract definition
 * @returns A typed QueryClient with per-endpoint methods
 *
 * @example
 * ```tsx
 * const typedQueryClient = createTypedQueryClient(queryClient, client, contract);
 *
 * // Type-safe cache operations
 * typedQueryClient.listUsers.getQueryData(['users']);
 * typedQueryClient.listUsers.setQueryData(['users'], newData);
 * await typedQueryClient.listUsers.prefetchQuery({
 *   queryKey: ['users'],
 *   queryData: { query: { limit: '10' } }
 * });
 * ```
 */
export function createTypedQueryClient<T extends Contract>(
  queryClient: QueryClient,
  client: Client<T>,
  contract: T,
): TypedQueryClient<T> {
  const typed = queryClient as TypedQueryClient<T>;

  for (const [name, endpoint] of Object.entries(contract)) {
    if (endpoint.type !== 'standard') continue;

    const clientMethod = client[
      name as keyof T
    ] as unknown as ClientMethod<StandardEndpointDefinition>;
    const typedEndpoint = endpoint as StandardEndpointDefinition;

    if (typedEndpoint.method === 'GET' || typedEndpoint.method === 'HEAD') {
      (typed as any)[name] = {
        getQueryData: (queryKey: QueryKey) => queryClient.getQueryData(queryKey),
        setQueryData: (queryKey: QueryKey, updater: any) =>
          queryClient.setQueryData(queryKey, updater),
        getQueryState: (queryKey: QueryKey) => queryClient.getQueryState(queryKey),
        fetchQuery: ({
          queryKey,
          queryData,
          ...rest
        }: TsrQueryOptions<StandardEndpointDefinition>) =>
          queryClient.fetchQuery({
            queryKey,
            queryFn: () => clientMethod(queryData),
            ...rest,
          }),
        prefetchQuery: ({
          queryKey,
          queryData,
          ...rest
        }: TsrQueryOptions<StandardEndpointDefinition>) =>
          queryClient.prefetchQuery({
            queryKey,
            queryFn: () => clientMethod(queryData),
            ...rest,
          }),
        ensureQueryData: ({
          queryKey,
          queryData,
          ...rest
        }: TsrQueryOptions<StandardEndpointDefinition>) =>
          queryClient.ensureQueryData({
            queryKey,
            queryFn: () => clientMethod(queryData),
            ...rest,
          }),
      } as TypedQueryEndpointClient<StandardEndpointDefinition>;
    } else {
      (typed as any)[name] = {} as TypedMutationEndpointClient<StandardEndpointDefinition>;
    }
  }

  return typed;
}

// ============================================
// Main Factory Function
// ============================================

/**
 * Create typed TanStack Query API for a contract
 *
 * @param client - The typed client created with createClient()
 * @param contract - The contract definition
 * @returns API object with hooks for each endpoint
 *
 * @example
 * ```tsx
 * const client = createClient(contract, { baseUrl: 'http://localhost:3000' });
 * const api = createTanstackQueryApi(client, contract);
 *
 * // Use in components - Query
 * function UserList() {
 *   const { data, isLoading } = api.listUsers.useQuery({
 *     queryKey: ['users'],
 *     queryData: { query: { limit: '10' } }
 *   });
 * }
 *
 * // Use in components - Mutation
 * function CreateUser() {
 *   const { mutate } = api.createUser.useMutation();
 *   return (
 *     <button onClick={() => mutate({ body: { name: 'Alice' } })}>
 *       Create
 *     </button>
 *   );
 * }
 *
 * // Direct fetch (no hooks)
 * const users = await api.listUsers.query({ query: { limit: '10' } });
 *
 * // Streaming with React Query
 * const { data: chunks, isFetching } = api.streamChat.useStreamQuery({
 *   queryKey: ['chat', prompt],
 *   queryData: { body: { prompt } }
 * });
 * ```
 */
export function createTanstackQueryApi<T extends Contract>(
  client: Client<T>,
  contract: T,
): TanstackQueryApi<T> {
  // Build endpoint APIs
  const endpoints: Record<string, unknown> = {};

  for (const [name, endpoint] of Object.entries(contract)) {
    // Handle streaming endpoints
    if (endpoint.type === 'streaming') {
      const streamMethod = client[
        name as keyof T
      ] as unknown as StreamingClientMethod<StreamingEndpointDefinition>;

      endpoints[name] = {
        stream: streamMethod,
        useStreamQuery: ({
          queryKey,
          queryData,
          refetchMode,
          ...rest
        }: TsrStreamQueryOptions<StreamingEndpointDefinition>) => {
          const result = useQuery({
            queryKey,
            queryFn: streamedQuery({
              streamFn: streamToAsyncIterable(streamMethod, queryData),
              refetchMode,
            }),
            ...rest,
          });
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
      } as StreamingEndpointApi<StreamingEndpointDefinition>;
      continue;
    }

    // Handle SSE endpoints
    if (endpoint.type === 'sse') {
      const connectMethod = client[
        name as keyof T
      ] as unknown as SSEClientMethod<SSEEndpointDefinition>;
      endpoints[name] = {
        connect: connectMethod,
      } as SSEEndpointApi<SSEEndpointDefinition>;
      continue;
    }

    // Handle download endpoints
    if (endpoint.type === 'download') {
      const downloadMethod = client[
        name as keyof T
      ] as unknown as DownloadClientMethod<DownloadEndpointDefinition>;
      endpoints[name] = {
        download: downloadMethod,
      } as DownloadEndpointApi<DownloadEndpointDefinition>;
      continue;
    }

    // Handle standard endpoints
    const method = endpoint.method;
    const clientMethod = client[
      name as keyof T
    ] as unknown as ClientMethod<StandardEndpointDefinition>;

    if (method === 'GET' || method === 'HEAD') {
      // Query endpoint
      endpoints[name] = {
        useQuery: ({
          queryKey,
          queryData,
          ...rest
        }: TsrQueryOptions<StandardEndpointDefinition>) => {
          const result = useQuery({
            queryKey,
            queryFn: () => clientMethod(queryData),
            ...rest,
          });
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
        useSuspenseQuery: ({
          queryKey,
          queryData,
          ...rest
        }: TsrSuspenseQueryOptions<StandardEndpointDefinition>) => {
          const result = useSuspenseQuery({
            queryKey,
            queryFn: () => clientMethod(queryData),
            ...rest,
          });
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
        useInfiniteQuery: <TPageParam = unknown>({
          queryKey,
          queryData,
          ...rest
        }: TsrInfiniteQueryOptions<StandardEndpointDefinition, TPageParam>) => {
          const result = useInfiniteQuery({
            queryKey,
            queryFn: (ctx: { pageParam: TPageParam }) =>
              clientMethod(queryData({ pageParam: ctx.pageParam })),
            ...rest,
          } as any);
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
        useSuspenseInfiniteQuery: <TPageParam = unknown>({
          queryKey,
          queryData,
          ...rest
        }: TsrSuspenseInfiniteQueryOptions<StandardEndpointDefinition, TPageParam>) => {
          const result = useSuspenseInfiniteQuery({
            queryKey,
            queryFn: (ctx: { pageParam: TPageParam }) =>
              clientMethod(queryData({ pageParam: ctx.pageParam })),
            ...rest,
          } as any);
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
        query: (options: EndpointRequestOptions<StandardEndpointDefinition>) =>
          clientMethod(options),
      } as QueryEndpointApi<StandardEndpointDefinition>;
    } else {
      // Mutation endpoint
      endpoints[name] = {
        useMutation: (options?: TsrMutationOptions<StandardEndpointDefinition>) => {
          const result = useMutation({
            mutationFn: (data: EndpointRequestOptions<StandardEndpointDefinition>) =>
              clientMethod(data),
            ...options,
          });
          return {
            ...result,
            contractEndpoint: endpoint,
          };
        },
        mutate: (options: EndpointRequestOptions<StandardEndpointDefinition>) =>
          clientMethod(options),
      } as MutationEndpointApi<StandardEndpointDefinition>;
    }
  }

  return endpoints as TanstackQueryApi<T>;
}
