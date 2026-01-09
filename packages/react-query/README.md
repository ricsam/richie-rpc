# @richie-rpc/react-query

React hooks integration for Richie RPC using TanStack Query (React Query v5). Provides type-safe hooks with automatic caching, background refetching, React Suspense support, and streaming integration.

## Installation

```bash
bun add @richie-rpc/react-query @richie-rpc/client @richie-rpc/core @tanstack/react-query zod@^4
```

## Features

- 🎯 **Fully Type-Safe**: Complete TypeScript inference from contract to hooks
- 🔄 **Automatic Method Detection**: GET/HEAD → queries, POST/PUT/PATCH/DELETE → mutations
- ⚡ **React Suspense**: Built-in support with `useSuspenseQuery`
- 💾 **Smart Caching**: Powered by TanStack Query
- 🎨 **Unified Options**: ts-rest-style `queryKey`/`queryData` pattern
- 📖 **Infinite Queries**: Built-in pagination support
- 🌊 **Streaming Integration**: TanStack Query integration via `useStreamQuery`
- 🔧 **Typed QueryClient**: Per-endpoint cache operations via `createTypedQueryClient`

## Quick Start

### 1. Create API

```tsx
import { createTanstackQueryApi } from '@richie-rpc/react-query';
import { client, contract } from './api'; // your client setup

const api = createTanstackQueryApi(client, contract);
```

### 2. Use Query Hooks (GET requests)

Query hooks use the unified `queryKey`/`queryData` pattern:

```tsx
function UserList() {
  const { data, isLoading, error, refetch } = api.listUsers.useQuery({
    queryKey: ['users', { limit: '10', offset: '0' }],
    queryData: { query: { limit: '10', offset: '0' } },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.data.users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### 3. Use Suspense Queries

For React Suspense integration:

```tsx
function UserListSuspense() {
  const { data } = api.listUsers.useSuspenseQuery({
    queryKey: ['users'],
    queryData: { query: { limit: '10' } },
  });

  return (
    <div>
      {data.data.users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

// Wrap with Suspense boundary
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserListSuspense />
    </Suspense>
  );
}
```

### 4. Use Mutation Hooks (POST/PUT/PATCH/DELETE)

Mutation hooks return a function to trigger the request:

```tsx
function CreateUserForm() {
  const mutation = api.createUser.useMutation({
    onSuccess: (data) => {
      console.log('User created:', data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate({ body: { name: 'Alice', email: 'alice@example.com' } });
    }}>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

## API Reference

### `createTanstackQueryApi(client, contract)`

Creates a typed API object from a client and contract.

**Parameters:**

- `client`: Client created with `createClient()`
- `contract`: Your API contract definition

**Returns:** API object with per-endpoint hooks and methods

### Query Endpoint API (GET/HEAD)

#### `api.endpoint.useQuery(options)`

Standard query hook.

```tsx
const { data, isLoading, error } = api.listUsers.useQuery({
  queryKey: ['users'],
  queryData: { query: { limit: '10' } },
  staleTime: 5000,
  // ...other TanStack Query options
});
```

#### `api.endpoint.useSuspenseQuery(options)`

Suspense-enabled query hook.

```tsx
const { data } = api.listUsers.useSuspenseQuery({
  queryKey: ['users'],
  queryData: { query: { limit: '10' } },
});
```

#### `api.endpoint.useInfiniteQuery(options)`

Infinite query for pagination.

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = api.listUsers.useInfiniteQuery({
  queryKey: ['users'],
  queryData: ({ pageParam }) => ({
    query: { limit: '10', offset: String(pageParam) },
  }),
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) => {
    const nextOffset = allPages.length * 10;
    return lastPage.data.users.length === 10 ? nextOffset : undefined;
  },
});
```

#### `api.endpoint.useSuspenseInfiniteQuery(options)`

Suspense-enabled infinite query.

#### `api.endpoint.query(options)`

Direct fetch without React Query.

```tsx
const result = await api.listUsers.query({ query: { limit: '10' } });
```

### Mutation Endpoint API (POST/PUT/PATCH/DELETE)

#### `api.endpoint.useMutation(options?)`

Mutation hook.

```tsx
const mutation = api.createUser.useMutation({
  onSuccess: (data) => console.log('Created:', data),
  onError: (error) => console.error('Failed:', error),
});

mutation.mutate({ body: { name: 'Alice', email: 'alice@example.com' } });
```

#### `api.endpoint.mutate(options)`

Direct mutate without React Query.

```tsx
const result = await api.createUser.mutate({
  body: { name: 'Alice', email: 'alice@example.com' },
});
```

### Streaming Endpoint API

#### `api.endpoint.stream(options)`

Direct stream access with event-based API:

```tsx
const result = await api.streamChat.stream({ body: { prompt: 'Hello' } });

result.on('chunk', (chunk) => {
  console.log(chunk.text);
});

result.on('close', (finalResponse) => {
  console.log('Done:', finalResponse);
});
```

#### `api.endpoint.useStreamQuery(options)`

TanStack Query integration using `experimental_streamedQuery`:

```tsx
const { data: chunks, isFetching } = api.streamChat.useStreamQuery({
  queryKey: ['chat', prompt],
  queryData: { body: { prompt } },
  refetchMode: 'reset', // 'reset' | 'append' | 'replace'
});

// chunks = accumulated array of chunk objects
// isFetching = true while streaming
```

### SSE Endpoint API

#### `api.endpoint.connect(options)`

Direct SSE connection:

```tsx
const connection = api.notifications.connect({ params: { id: '123' } });

connection.on('message', (data) => {
  console.log('Message:', data.text);
});

connection.on('heartbeat', (data) => {
  console.log('Heartbeat:', data.timestamp);
});
```

### Download Endpoint API

#### `api.endpoint.download(options)`

Direct file download:

```tsx
const response = await api.downloadFile.download({ params: { id: 'file123' } });
```

### `createTypedQueryClient(queryClient, client, contract)`

Create a typed QueryClient wrapper with per-endpoint cache methods. This is useful for type-safe cache operations like prefetching, getting/setting query data, etc.

```tsx
import { createTypedQueryClient } from '@richie-rpc/react-query';

// Create at module level alongside your api
const typedClient = createTypedQueryClient(queryClient, client, contract);

// Type-safe cache operations
typedClient.listUsers.getQueryData(['users']);
typedClient.listUsers.setQueryData(['users'], (old) => ({
  ...old,
  data: { ...old.data, users: [...old.data.users, newUser] },
}));

// Prefetching
await typedClient.listUsers.prefetchQuery({
  queryKey: ['users'],
  queryData: { query: { limit: '10' } },
});
```

**Available methods per query endpoint:**

- `getQueryData(queryKey)` - Get cached data
- `setQueryData(queryKey, updater)` - Update cached data
- `getQueryState(queryKey)` - Get query state
- `fetchQuery(options)` - Fetch and cache data
- `prefetchQuery(options)` - Prefetch data in background
- `ensureQueryData(options)` - Get cached data or fetch if missing

## Error Handling

The package includes error handling utilities:

```tsx
import { isFetchError, isUnknownErrorResponse } from '@richie-rpc/react-query';

const { error, contractEndpoint } = api.getUser.useQuery({
  queryKey: ['user', id],
  queryData: { params: { id } },
});

if (error) {
  if (isFetchError(error)) {
    console.log('Network error:', error.message);
  } else if (isUnknownErrorResponse(error, contractEndpoint)) {
    console.log('Unknown status:', error.status);
  }
}
```

### `isFetchError(error)`

Returns `true` if the error is a network/fetch error (not a response).

### `isUnknownErrorResponse(error, endpoint)`

Returns `true` if the error is a response with a status code not defined in the contract.

### `isNotKnownResponseError(error, endpoint)`

Returns `true` if the error is either a fetch error or an unknown response error.

### `exhaustiveGuard(value)`

For compile-time exhaustiveness checking in switch statements.

## Advanced Usage

### Custom Query Options

Pass TanStack Query options alongside queryKey and queryData:

```tsx
const { data } = api.listUsers.useQuery({
  queryKey: ['users'],
  queryData: { query: { limit: '10' } },
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  refetchInterval: 30000, // Refetch every 30 seconds
  refetchOnWindowFocus: false,
});
```

### Dependent Queries

Enable queries only when conditions are met:

```tsx
function UserPosts({ userId }: { userId: string | null }) {
  const { data } = api.getUserPosts.useQuery({
    queryKey: ['posts', userId],
    queryData: { params: { userId: userId! } },
    enabled: !!userId, // Only fetch when userId is available
  });
}
```

### Optimistic Updates

Update the UI immediately before the server responds:

```tsx
// Module level - create once
const typedClient = createTypedQueryClient(queryClient, client, contract);

function UpdateUserForm({ userId }: { userId: string }) {
  const mutation = api.updateUser.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['user', userId] });
      const previousUser = typedClient.getUser.getQueryData(['user', userId]);

      typedClient.getUser.setQueryData(['user', userId], (old) => ({
        ...old,
        data: { ...old.data, ...variables.body },
      }));

      return { previousUser };
    },
    onError: (err, variables, context) => {
      if (context?.previousUser) {
        typedClient.getUser.setQueryData(['user', userId], context.previousUser);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });
}
```

## TypeScript Types

### Exported Types

```tsx
import type {
  TsrQueryOptions,
  TsrSuspenseQueryOptions,
  TsrInfiniteQueryOptions,
  TsrSuspenseInfiniteQueryOptions,
  TsrMutationOptions,
  TsrStreamQueryOptions,
  TsrResponse,
  TsrError,
  TypedQueryClient,
  TanstackQueryApi,
} from '@richie-rpc/react-query';
```

### Type Inference

Extract types from your API:

```tsx
import type { EndpointResponse } from '@richie-rpc/client';

// Get the response type for an endpoint
type UserListResponse = EndpointResponse<typeof contract.listUsers>;
```

## TanStack Query Re-exports

For version consistency, you can import TanStack Query from this package:

```tsx
import { QueryClient, QueryClientProvider } from '@richie-rpc/react-query/tanstack';
```

## Best Practices

1. **Create API once**: Create the API object at the module level, not inside components
2. **Use meaningful queryKeys**: Include relevant parameters in queryKey for proper cache separation
3. **Use Suspense for loading states**: Cleaner than manual loading state management
4. **Invalidate related queries**: After mutations, invalidate queries that may be affected
5. **Use createTypedQueryClient**: For type-safe cache operations like prefetching and setQueryData
6. **Handle errors exhaustively**: Use the error utilities for proper error handling

## Examples

See the `packages/demo` directory for complete working examples:

- [react-example.tsx](../demo/react-example.tsx) - Query and mutation hooks
- [dictionary-example.tsx](../demo/dictionary-example.tsx) - Complex data structures

## License

MIT
