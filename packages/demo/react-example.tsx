/**
 * React Query Hooks Example
 *
 * This file demonstrates how to use @richie-rpc/react-query with the users contract.
 *
 * To run this example in a real React app:
 * 1. Install dependencies: bun add @tanstack/react-query react react-dom
 * 2. Start the demo server: bun run server.ts
 * 3. Use this code in your React application
 */

import { createClient } from '@richie-rpc/client';
import { createHooks } from '@richie-rpc/react-query';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usersContract } from './contract';

// Create the client
const client = createClient(usersContract, {
  baseUrl: '/api',
});

// Create hooks from the client and contract
const hooks = createHooks(client, usersContract);

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Example 1: Basic Query Hook (GET request)
 * Automatically fetches data when component mounts
 */
function UserList() {
  const { data, isLoading, error, refetch } = hooks.listUsers.useQuery({
    query: { limit: '10', offset: '0' },
  });

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  // data is guaranteed to exist here due to the loading check
  const users = data?.data.users;
  if (!users) return null;

  return (
    <div className="user-list">
      <h2>Users ({data?.data.total})</h2>
      <button type="button" onClick={() => refetch()}>
        Refresh
      </button>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.name} - {user.email}
            {user.age && ` (${user.age} years old)`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 2: Suspense Query Hook
 * Uses React Suspense for loading state
 */
function UserListSuspense() {
  const { data } = hooks.listUsers.useSuspenseQuery({
    query: { limit: '10', offset: '0' },
  });

  // With Suspense, data is always defined when this renders
  const users = data.data.users;

  return (
    <div className="user-list">
      <h2>Users (Suspense) - {data.data.total} total</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 3: Single User Query with Params
 */
function UserDetail({ userId }: { userId: string }) {
  const { data, isLoading, error } = hooks.getUser.useQuery({
    params: { id: userId },
  });

  if (isLoading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;

  // Handle both success and error responses
  if (data?.status === 404) {
    return <div>User not found</div>;
  }

  const user = data?.data;
  if (!user) return null;

  return (
    <div className="user-detail">
      <h3>{user.name}</h3>
      <p>Email: {user.email}</p>
      {user.age && <p>Age: {user.age}</p>}
    </div>
  );
}

/**
 * Example 4: Mutation Hook (POST request)
 * Create a new user
 */
function CreateUserForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');

  const createMutation = hooks.createUser.useMutation({
    onSuccess: (data) => {
      console.log('User created:', data);
      // Invalidate and refetch the user list
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
      // Clear form
      setName('');
      setEmail('');
      setAge('');
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      body: {
        name,
        email,
        age: age ? Number.parseInt(age, 10) : undefined,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="create-user-form">
      <h3>Create New User</h3>
      <div>
        <label>
          Name:
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Age (optional):
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.currentTarget.value)}
            min="0"
          />
        </label>
      </div>
      <button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : 'Create User'}
      </button>
      {createMutation.error && <div className="error">Error: {createMutation.error.message}</div>}
      {createMutation.data && <div className="success">User created successfully!</div>}
    </form>
  );
}

/**
 * Example 5: Update Mutation
 */
function _UpdateUserForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const updateMutation = hooks.updateUser.useMutation({
    onSuccess: () => {
      // Invalidate both the list and the specific user query
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
      queryClient.invalidateQueries({
        queryKey: ['getUser', { params: { id: userId } }],
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      params: { id: userId },
      body: {
        name: name || undefined,
        email: email || undefined,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Update User</h3>
      <input
        type="text"
        placeholder="New name"
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="New email"
        value={email}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Updating...' : 'Update'}
      </button>
    </form>
  );
}

/**
 * Example 6: Delete Mutation
 */
function _DeleteUserButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const deleteMutation = hooks.deleteUser.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
    },
  });

  return (
    <button
      type="button"
      onClick={() => deleteMutation.mutate({ params: { id: userId } })}
      disabled={deleteMutation.isPending}
      className="delete-button"
    >
      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}

/**
 * Example 7: Advanced - Optimistic Update
 */
function _OptimisticUpdateExample({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const updateMutation = hooks.updateUser.useMutation({
    // Before the mutation runs, update the UI optimistically
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['getUser', { params: { id: userId } }],
      });

      // Snapshot the previous value
      const previousUser = queryClient.getQueryData(['getUser', { params: { id: userId } }]);

      // Optimistically update to the new value
      queryClient.setQueryData(['getUser', { params: { id: userId } }], (old: unknown) => ({
        ...(old as Record<string, unknown>),
        data: { ...(old as { data: Record<string, unknown> }).data, ...variables.body },
      }));

      // Return context with the previous value
      return { previousUser } as { previousUser: unknown };
    },
    // If the mutation fails, rollback using the context
    onError: (_err, _variables, context) => {
      if (
        context &&
        typeof context === 'object' &&
        'previousUser' in context &&
        context.previousUser
      ) {
        queryClient.setQueryData(['getUser', { params: { id: userId } }], context.previousUser);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['getUser', { params: { id: userId } }],
      });
    },
  });

  return (
    <button
      type="button"
      onClick={() =>
        updateMutation.mutate({
          params: { id: userId },
          body: { name: 'Updated Name' },
        })
      }
    >
      Update with Optimistic UI
    </button>
  );
}

/**
 * Example 8: Parallel Queries
 */
function Dashboard() {
  // All these queries run in parallel
  const usersQuery = hooks.listUsers.useQuery({ query: {} });
  const teapotQuery = hooks.teapot.useQuery({});

  if (usersQuery.isLoading || teapotQuery.isLoading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p>Total users: {usersQuery.data?.data.total}</p>
      <p>Teapot status: {teapotQuery.data?.data.message}</p>
    </div>
  );
}

/**
 * Main App Component
 */
export function App() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>('1');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <h1>Richie RPC React Query Demo</h1>

        {/* Standard Query Example */}
        <section>
          <UserList />
        </section>

        {/* Suspense Query Example */}
        <section>
          <Suspense fallback={<div className="loading">Loading with Suspense...</div>}>
            <UserListSuspense />
          </Suspense>
        </section>

        {/* Single User Query */}
        {selectedUserId && (
          <section>
            <UserDetail userId={selectedUserId} />
            <button type="button" onClick={() => setSelectedUserId(null)}>
              Clear Selection
            </button>
          </section>
        )}

        {/* Create User Mutation */}
        <section>
          <CreateUserForm />
        </section>

        {/* Parallel Queries */}
        <section>
          <Dashboard />
        </section>
      </div>
    </QueryClientProvider>
  );
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('root');
  if (root) {
    const reactRoot = createRoot(root);
    reactRoot.render(<App />);

    // Handle HMR
    if (import.meta.hot) {
      import.meta.hot.accept();
      import.meta.hot.dispose(() => {
        reactRoot.unmount();
      });
    }
  }
}
