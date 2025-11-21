# @richie-rpc/react-query

React hooks integration for Richie RPC using TanStack Query (React Query). Provides type-safe hooks with automatic caching, background refetching, and React Suspense support.

## Installation

```bash
bun add @richie-rpc/react-query @richie-rpc/client @richie-rpc/core @tanstack/react-query zod@^4
```

## Features

- 🎯 **Fully Type-Safe**: Complete TypeScript inference from contract to hooks
- 🔄 **Automatic Method Detection**: GET/HEAD → queries, POST/PUT/PATCH/DELETE → mutations
- ⚡ **React Suspense**: Built-in support with `useSuspenseQuery`
- 💾 **Smart Caching**: Powered by TanStack Query
- 🔥 **Zero Config**: Works out of the box with sensible defaults
- 🎨 **Customizable**: Pass through all TanStack Query options

## Quick Start

### 1. Setup Provider

Wrap your app with `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@richie-rpc/client';
import { createHooks } from '@richie-rpc/react-query';
import { contract } from './contract';

// Create client and hooks
const client = createClient(contract, {
  baseUrl: 'http://localhost:3000',
});

const hooks = createHooks(client, contract);

// Create query client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

### 2. Use Query Hooks (GET requests)

Query hooks automatically fetch data when the component mounts:

```tsx
function UserList() {
  const { data, isLoading, error, refetch } = hooks.listUsers.useQuery({
    query: { limit: "10", offset: "0" }
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.data.users.map(user => (
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
  // This will suspend the component until data is loaded
  const { data } = hooks.listUsers.useSuspenseQuery({
    query: { limit: "10" }
  });

  return (
    <div>
      {data.data.users.map(user => (
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

Mutation hooks don't auto-fetch; they return a function to trigger the request:

```tsx
function CreateUserForm() {
  const mutation = hooks.createUser.useMutation({
    onSuccess: (data) => {
      console.log('User created:', data);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      body: {
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button 
        type="submit" 
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>
      {mutation.error && <div>Error: {mutation.error.message}</div>}
    </form>
  );
}
```

## API Reference

### `createHooks(client, contract)`

Creates a typed hooks object from a client and contract.

**Parameters:**
- `client`: Client created with `createClient()`
- `contract`: Your API contract definition

**Returns:** Hooks object with methods for each endpoint

### Query Hooks (GET/HEAD methods)

#### `hooks.endpointName.useQuery(options, queryOptions?)`

Standard query hook for read operations.

**Parameters:**
- `options`: Request options (params, query, headers, body)
- `queryOptions`: Optional TanStack Query options (staleTime, cacheTime, etc.)

**Returns:** `UseQueryResult` with data, isLoading, error, refetch, etc.

#### `hooks.endpointName.useSuspenseQuery(options, queryOptions?)`

Suspense-enabled query hook.

**Parameters:**
- `options`: Request options (params, query, headers, body)
- `queryOptions`: Optional TanStack Query options

**Returns:** `UseSuspenseQueryResult` with data (always defined when rendered)

### Mutation Hooks (POST/PUT/PATCH/DELETE methods)

#### `hooks.endpointName.useMutation(mutationOptions?)`

Mutation hook for write operations.

**Parameters:**
- `mutationOptions`: Optional TanStack Query mutation options (onSuccess, onError, etc.)

**Returns:** `UseMutationResult` with mutate, isPending, error, data, etc.

## Advanced Usage

### Custom Query Options

Pass TanStack Query options for fine-grained control:

```tsx
const { data } = hooks.listUsers.useQuery(
  { query: { limit: "10" } },
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: false,
  }
);
```

### Invalidating Queries

After a mutation, invalidate related queries to trigger refetch:

```tsx
import { useQueryClient } from '@tanstack/react-query';

function DeleteUserButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const mutation = hooks.deleteUser.useMutation({
    onSuccess: () => {
      // Invalidate all queries that start with 'listUsers'
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
      
      // Or invalidate specific query
      queryClient.invalidateQueries({ 
        queryKey: ['getUser', { params: { id: userId } }] 
      });
    },
  });

  return (
    <button onClick={() => mutation.mutate({ params: { id: userId } })}>
      Delete User
    </button>
  );
}
```

### Optimistic Updates

Update the UI immediately before the server responds:

```tsx
const mutation = hooks.updateUser.useMutation({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['getUser'] });

    // Snapshot previous value
    const previousUser = queryClient.getQueryData(['getUser', { params: { id: userId } }]);

    // Optimistically update
    queryClient.setQueryData(['getUser', { params: { id: userId } }], (old) => ({
      ...old,
      data: { ...old.data, ...variables.body }
    }));

    return { previousUser };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    if (context?.previousUser) {
      queryClient.setQueryData(
        ['getUser', { params: { id: userId } }],
        context.previousUser
      );
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['getUser'] });
  },
});
```

### Dependent Queries

Enable queries only when conditions are met:

```tsx
function UserPosts({ userId }: { userId: string | null }) {
  const { data } = hooks.getUserPosts.useQuery(
    { params: { userId: userId! } },
    {
      enabled: !!userId, // Only fetch when userId is available
    }
  );

  // ...
}
```

### Parallel Queries

Fetch multiple queries at once:

```tsx
function Dashboard() {
  const users = hooks.listUsers.useQuery({ query: {} });
  const stats = hooks.getStats.useQuery({});
  const settings = hooks.getSettings.useQuery({});

  if (users.isLoading || stats.isLoading || settings.isLoading) {
    return <div>Loading...</div>;
  }

  // All queries are fetched in parallel
  return <div>Dashboard with {users.data.data.total} users</div>;
}
```

## TypeScript Tips

### Inferring Types

Extract types from your hooks:

```tsx
import type { EndpointResponse } from '@richie-rpc/client';
import type { contract } from './contract';

// Get the response type for an endpoint
type UserListResponse = EndpointResponse<typeof contract.listUsers>;

// Or extract from hook result
type UserData = Awaited<ReturnType<typeof hooks.listUsers.useQuery>>['data'];
```

### Type-Safe Query Keys

Create a helper for consistent query keys:

```tsx
const queryKeys = {
  listUsers: (query: { limit?: string; offset?: string }) => 
    ['listUsers', { query }] as const,
  getUser: (id: string) => 
    ['getUser', { params: { id } }] as const,
};

// Use in invalidation
queryClient.invalidateQueries({ queryKey: queryKeys.listUsers({}) });
```

## Best Practices

1. **Create hooks once**: Create the hooks object at the module level, not inside components
2. **Use Suspense for loading states**: Cleaner than manual loading state management
3. **Invalidate related queries**: After mutations, invalidate queries that may be affected
4. **Set appropriate staleTime**: Reduce unnecessary refetches by setting staleTime
5. **Handle errors with Error Boundaries**: Use React Error Boundaries with Suspense queries

## Examples

See the `packages/demo` directory for complete working examples.

## License

MIT

