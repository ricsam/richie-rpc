/**
 * React Query Hooks Example with TanStack Router
 *
 * This file demonstrates how to use @richie-rpc/react-query with the users contract
 * and streaming/WebSocket features with TanStack Router navigation.
 */

import { createClient, ErrorResponse } from '@richie-rpc/client';
import { createWebSocketClient } from '@richie-rpc/client/websocket';
import { createTanstackQueryApi } from '@richie-rpc/react-query';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import {
  type ChangeEvent,
  Component,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { usersContract } from './contract';
import { streamingContract } from './streaming-contract';
import { chatContract } from './websocket-contract';

// ===========================================
// Client Setup
// ===========================================

// Create the REST client
const client = createClient(usersContract, {
  baseUrl: '/api',
});

// Create streaming client
const streamingClient = createClient(streamingContract, {
  baseUrl: '/streaming',
});

// Create WebSocket client
const wsClient = createWebSocketClient(chatContract, {
  baseUrl: '/',
});

// Create TanStack Query API from the client and contract
const api = createTanstackQueryApi(client, usersContract);

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// ===========================================
// User API Components (existing)
// ===========================================

function UserList() {
  const { data, isLoading, error, refetch } = api.listUsers.useQuery({
    queryKey: ['listUsers', { limit: '10', offset: '0' }],
    queryData: { query: { limit: '10', offset: '0' } },
  });

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  const users = data?.payload.users;
  if (!users) return null;

  return (
    <div className="user-list">
      <h2>Users ({data?.payload.total})</h2>
      <button type="button" onClick={() => refetch()}>
        Refresh
      </button>
      <ul>
        {users.map((user: { id: string; name: string; email: string; age?: number }) => (
          <li key={user.id}>
            {user.name} - {user.email}
            {user.age && ` (${user.age} years old)`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserListSuspense() {
  const { data } = api.listUsers.useSuspenseQuery({
    queryKey: ['listUsers', 'suspense'],
    queryData: { query: { limit: '10', offset: '0' } },
  });

  const users = data.payload.users;

  return (
    <div className="user-list">
      <h2>Users (Suspense) - {data.payload.total} total</h2>
      <ul>
        {users.map((user: { id: string; name: string; email: string }) => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserDetail({ userId }: { userId: string }) {
  const { data, isLoading, error } = api.getUser.useQuery({
    queryKey: ['getUser', userId],
    queryData: { params: { id: userId } },
  });

  if (isLoading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const user = data?.payload;
  if (!user) return null;

  return (
    <div className="user-detail">
      <h3>{user.name}</h3>
      <p>Email: {user.email}</p>
      {user.age && <p>Age: {user.age}</p>}
    </div>
  );
}

function CreateUserForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');

  const createMutation = api.createUser.useMutation({
    onSuccess: (data: { status: number; payload: unknown }) => {
      console.log('User created:', data);
      queryClient.invalidateQueries({ queryKey: ['listUsers'] });
      setName('');
      setEmail('');
      setAge('');
    },
    onError: (error: Error) => {
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

function FileUploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('documents');

  const uploadMutation = api.uploadDocuments.useMutation({
    onSuccess: (data: { status: number; payload: { uploadedCount: number; totalSize: number } }) => {
      console.log('Upload successful:', data);
      setFiles([]);
    },
    onError: (error: Error) => {
      console.error('Upload failed:', error);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    uploadMutation.mutate({
      body: {
        documents: files.map((file) => ({
          file,
          name: file.name,
          tags: ['uploaded-via-react'],
        })),
        category,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="file-upload-form">
      <h3>Upload Documents</h3>
      <div>
        <label>
          Files:
          <input type="file" multiple onChange={handleFileChange} />
        </label>
      </div>
      <div>
        <label>
          Category:
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="documents">Documents</option>
            <option value="images">Images</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      {files.length > 0 && (
        <div className="selected-files">
          <p>Selected files:</p>
          <ul>
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="submit" disabled={uploadMutation.isPending || files.length === 0}>
        {uploadMutation.isPending ? 'Uploading...' : 'Upload Files'}
      </button>
      {uploadMutation.error && <div className="error">Error: {uploadMutation.error.message}</div>}
      {uploadMutation.data && (
        <div className="success">
          Uploaded {uploadMutation.data.payload.uploadedCount} files (
          {(uploadMutation.data.payload.totalSize / 1024).toFixed(2)} KB total)
        </div>
      )}
    </form>
  );
}

function Dashboard() {
  const usersQuery = api.listUsers.useQuery({
    queryKey: ['listUsers', 'dashboard'],
    queryData: { query: {} },
  });
  const teapotQuery = api.teapot.useQuery({
    queryKey: ['teapot'],
    queryData: {},
  });

  if (usersQuery.isLoading || teapotQuery.isLoading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p>Total users: {usersQuery.data?.payload.total}</p>
      <p>Teapot status: {teapotQuery.data?.payload.message}</p>
    </div>
  );
}

// ===========================================
// Error Handling Demos
// ===========================================

/**
 * Error boundary that understands ErrorResponse.
 * In a real app, this would be a reusable component wrapping your routes.
 */
class ApiErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ApiErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, () => this.setState({ error: null }));
      }
      return (
        <div className="error-boundary">
          <p>Something went wrong: {this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Demo: useSuspenseQuery with error boundary
 *
 * With errorResponses, data is ALWAYS the success type — no discrimination needed.
 * Errors (404, etc.) are thrown and caught by the error boundary.
 */
function UserDetailSuspense({ userId }: { userId: string }) {
  // data is always { status: 200, payload: User } — never 404
  // If the user doesn't exist, ErrorResponse is thrown and caught by the boundary
  const { data } = api.getUser.useSuspenseQuery({
    queryKey: ['getUser', 'suspense', userId],
    queryData: { params: { id: userId } },
  });

  // No status check needed! data.payload is always the User type
  return (
    <div className="user-detail">
      <h3>{data.payload.name}</h3>
      <p>Email: {data.payload.email}</p>
      {data.payload.age !== undefined && <p>Age: {data.payload.age}</p>}
    </div>
  );
}

/**
 * Demo: useQuery with typed error handling
 *
 * With errorResponses, the error field can be an ErrorResponse with
 * a typed payload — no more discriminating on data.status.
 */
function UserDetailWithErrorHandling({ userId }: { userId: string }) {
  const { data, isLoading, error } = api.getUser.useQuery({
    queryKey: ['getUser', 'error-demo', userId],
    queryData: { params: { id: userId } },
    retry: false,
  });

  if (isLoading) return <div className="loading">Loading user...</div>;

  // Error responses (404, etc.) land here — not on data
  if (error) {
    if (api.getUser.isErrorResponse(error)) {
      // error.payload is fully typed from the contract's errorResponses
      // error.status is narrowed to 404 (the only error status for getUser)
      return (
        <div className="error-response">
          <h4>Error {error.status}</h4>
          <p>{error.payload.message || error.payload.error}</p>
        </div>
      );
    }
    // Network errors, etc.
    return <div className="error">Network error: {error.message}</div>;
  }

  // data is always the success type — no status discrimination needed
  if (!data) return null;
  return (
    <div className="user-detail">
      <h3>{data.payload.name}</h3>
      <p>Email: {data.payload.email}</p>
      {data.payload.age !== undefined && <p>Age: {data.payload.age}</p>}
    </div>
  );
}

/**
 * Wrapper that demonstrates both patterns side by side
 */
function ErrorHandlingDemo() {
  const [userId, setUserId] = useState('1');

  return (
    <div className="error-handling-demo">
      <h2>Error Handling Demo</h2>
      <p>
        Error status codes (404, 400, etc.) defined in <code>errorResponses</code> are thrown as{' '}
        <code>ErrorResponse</code> instead of returned as data. Try an existing ID (1, 2) vs a
        non-existent one.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          User ID:{' '}
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.currentTarget.value)}
            style={{ width: '80px', marginRight: '0.5rem' }}
          />
        </label>
        <button type="button" onClick={() => setUserId('1')}>
          Existing (1)
        </button>{' '}
        <button type="button" onClick={() => setUserId('non-existent')}>
          Non-existent
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <h3>useQuery</h3>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            Errors land on the <code>error</code> field. Check with <code>isErrorResponse()</code>.
          </p>
          <UserDetailWithErrorHandling userId={userId} />
        </div>

        <div>
          <h3>useSuspenseQuery + ErrorBoundary</h3>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            Data is always the success type. Errors are caught by the boundary.
          </p>
          <ApiErrorBoundary
            key={userId}
            fallback={(error, reset) => {
              if (error instanceof ErrorResponse) {
                const payload = error.payload as { error: string; message?: string };
                return (
                  <div className="error-response">
                    <h4>Error {error.status}</h4>
                    <p>{payload.message || payload.error}</p>
                    <button type="button" onClick={reset}>
                      Retry
                    </button>
                  </div>
                );
              }
              return (
                <div className="error">
                  <p>{error.message}</p>
                  <button type="button" onClick={reset}>
                    Retry
                  </button>
                </div>
              );
            }}
          >
            <Suspense fallback={<div className="loading">Loading...</div>}>
              <UserDetailSuspense userId={userId} />
            </Suspense>
          </ApiErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// Users Demo Page
// ===========================================

function UsersDemo() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>('1');

  return (
    <div className="app">
      <h1>Users API Demo</h1>

      <section>
        <UserList />
      </section>

      <section>
        <Suspense fallback={<div className="loading">Loading with Suspense...</div>}>
          <UserListSuspense />
        </Suspense>
      </section>

      {selectedUserId && (
        <section>
          <UserDetail userId={selectedUserId} />
          <button type="button" onClick={() => setSelectedUserId(null)}>
            Clear Selection
          </button>
        </section>
      )}

      <section>
        <CreateUserForm />
      </section>

      <section>
        <FileUploadForm />
      </section>

      <section>
        <Dashboard />
      </section>

      <section>
        <ErrorHandlingDemo />
      </section>
    </div>
  );
}

// ===========================================
// Chat Demo (WebSocket)
// ===========================================

interface ChatMessage {
  username: string;
  text: string;
  timestamp: string;
}

function ChatDemo() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<ReturnType<typeof wsClient.chat> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current?.connected) {
        wsRef.current = null;
      }
    };
  }, []);

  const handleJoin = () => {
    if (!username.trim()) return;

    setError(null);
    const ws = wsClient.chat();
    wsRef.current = ws;

    ws.onStateChange((isConnected) => {
      setConnected(isConnected);
      if (!isConnected && joined) {
        setJoined(false);
        setError('Connection lost. Please rejoin.');
      }
    });

    ws.onError((err) => {
      setError(err.message);
    });

    ws.on('userJoined', (payload) => {
      setUserCount(payload.userCount);
      if (payload.username !== username) {
        setMessages((prev) => [
          ...prev,
          {
            username: 'System',
            text: `${payload.username} joined the chat`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });

    ws.on('userLeft', (payload) => {
      setUserCount(payload.userCount);
      setMessages((prev) => [
        ...prev,
        {
          username: 'System',
          text: `${payload.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setTypingUsers((prev) => prev.filter((u) => u !== payload.username));
    });

    ws.on('message', (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    ws.on('typing', (payload) => {
      if (payload.isTyping) {
        setTypingUsers((prev) =>
          prev.includes(payload.username) ? prev : [...prev, payload.username],
        );
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== payload.username));
      }
    });

    ws.on('error', (payload) => {
      setError(payload.message);
    });

    // Connect and join
    const _disconnect = ws.connect();

    // Wait for connection then send join
    const checkAndJoin = setInterval(() => {
      if (ws.connected) {
        clearInterval(checkAndJoin);
        ws.send('join', { username: username.trim() });
        setJoined(true);
      }
    }, 100);

    // Cleanup interval after 5 seconds
    setTimeout(() => clearInterval(checkAndJoin), 5000);
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current?.connected) return;

    wsRef.current.send('message', { text: input.trim() });
    setInput('');

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    wsRef.current.send('typing', { isTyping: false });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!wsRef.current?.connected) return;

    // Send typing indicator
    wsRef.current.send('typing', { isTyping: true });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = window.setTimeout(() => {
      wsRef.current?.send('typing', { isTyping: false });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!joined) {
    return (
      <div className="chat-demo">
        <h1>WebSocket Chat</h1>
        <div className="chat-join">
          <h2>Join Chat</h2>
          {error && <div className="error">{error}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
          >
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              minLength={1}
            />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-demo">
      <h1>WebSocket Chat</h1>

      <div className="chat-header">
        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
        <span className="user-count">{userCount} user(s) online</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-message ${msg.username === username ? 'own' : ''} ${msg.username === 'System' ? 'system' : ''}`}
          >
            <span className="message-username">{msg.username}</span>
            <span className="message-text">{msg.text}</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button type="submit" disabled={!connected || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// ===========================================
// AI Streaming Demo
// ===========================================

interface StreamingStats {
  totalTokens: number;
  completionTime: number;
}

function AIStreamingDemo() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [stats, setStats] = useState<StreamingStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isStreaming) return;

    setResponse('');
    setStats(null);
    setError(null);
    setIsStreaming(true);

    try {
      const result = await streamingClient.aiChat({
        body: { prompt: prompt.trim() },
      });

      abortRef.current = () => result.abort();

      result.on('chunk', (chunk) => {
        setResponse((prev) => prev + chunk.text);
      });

      result.on('close', (final) => {
        if (final) {
          setStats(final);
        }
        setIsStreaming(false);
        abortRef.current = null;
      });

      result.on('error', (err) => {
        setError(err.message);
        setIsStreaming(false);
        abortRef.current = null;
      });
    } catch (err) {
      setError((err as Error).message);
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  return (
    <div className="ai-streaming-demo">
      <h1>AI Streaming Demo</h1>
      <p className="description">
        Enter a prompt and watch the response stream back word by word. This demonstrates NDJSON
        streaming with POST requests.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="prompt-section">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here... (e.g., 'The quick brown fox jumps over the lazy dog')"
          rows={4}
          disabled={isStreaming}
        />
        <div className="buttons">
          {!isStreaming ? (
            <button type="button" onClick={handleGenerate} disabled={!prompt.trim()}>
              Generate
            </button>
          ) : (
            <button type="button" onClick={handleStop} className="stop-button">
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="response-section">
        <h3>Response</h3>
        <div className={`response-content ${isStreaming ? 'streaming' : ''}`}>
          {response || <span className="placeholder">Response will appear here...</span>}
          {isStreaming && <span className="cursor">|</span>}
        </div>
      </div>

      {stats && (
        <div className="stats-section">
          <h3>Stats</h3>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total Tokens:</span>
              <span className="stat-value">{stats.totalTokens}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Completion Time:</span>
              <span className="stat-value">{stats.completionTime}ms</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tokens/sec:</span>
              <span className="stat-value">
                {((stats.totalTokens / stats.completionTime) * 1000).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// Logs Demo (SSE)
// ===========================================

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

function LogsDemo() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const connectionRef = useRef<ReturnType<typeof streamingClient.logs> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Connect/reconnect on filter change
  useEffect(() => {
    // Close existing connection
    if (connectionRef.current) {
      connectionRef.current.close();
    }

    // Create new connection
    const connection = streamingClient.logs({
      query: { level: filter === 'all' ? undefined : filter },
    });
    connectionRef.current = connection;

    // Update connected state
    const checkState = setInterval(() => {
      setConnected(connection.state === 'open');
    }, 100);

    connection.on('log', (data) => {
      setLogs((prev) => {
        const newLogs = [...prev, data];
        // Keep last 100 entries
        return newLogs.slice(-100);
      });
    });

    connection.on('heartbeat', () => {
      // Heartbeat received - connection is alive
    });

    connection.on('error', () => {
      setConnected(false);
    });

    return () => {
      clearInterval(checkState);
      connection.close();
    };
  }, [filter]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'level-info';
      case 'warn':
        return 'level-warn';
      case 'error':
        return 'level-error';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="logs-demo">
      <h1>Live Logs (SSE)</h1>
      <p className="description">
        Watch real-time log entries stream in via Server-Sent Events. Filter by level to see
        specific log types.
      </p>

      <div className="logs-header">
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connected' : 'Connecting...'}</span>
        </div>

        <div className="logs-controls">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          <label className="auto-scroll-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>

          <button type="button" onClick={handleClearLogs}>
            Clear
          </button>
        </div>
      </div>

      <div className="logs-container">
        {logs.length === 0 ? (
          <div className="logs-empty">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`log-entry ${getLevelColor(log.level)}`}>
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className={`log-level ${getLevelColor(log.level)}`}>
                {log.level.toUpperCase()}
              </span>
              {log.source && <span className="log-source">[{log.source}]</span>}
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="logs-footer">
        <span>{logs.length} log entries</span>
      </div>
    </div>
  );
}

// ===========================================
// Download Demo
// ===========================================

interface DownloadState {
  status: 'idle' | 'downloading' | 'success' | 'error';
  progress: number;
  loaded: number;
  total: number;
  file: File | null;
  error: string | null;
}

function DownloadDemo() {
  const [fileId, setFileId] = useState('doc-1');
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
    loaded: 0,
    total: 0,
    file: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDownload = async () => {
    // Reset state
    setDownloadState({
      status: 'downloading',
      progress: 0,
      loaded: 0,
      total: 0,
      file: null,
      error: null,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const result = await client.downloadFile({
        params: { fileId },
        abortSignal: abortControllerRef.current.signal,
        onDownloadProgress: (event) => {
          const progressPercent = Number.isNaN(event.progress) ? 0 : event.progress * 100;
          console.log(
            `Download progress: ${progressPercent.toFixed(1)}% (${event.loaded}/${event.total} bytes)`,
          );
          setDownloadState((prev) => ({
            ...prev,
            progress: progressPercent,
            loaded: event.loaded,
            total: event.total,
          }));
        },
      });

      if (result.status === 200) {
        setDownloadState((prev) => ({
          ...prev,
          status: 'success',
          progress: 100,
          file: result.payload,
        }));
      } else {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: result.payload.message || result.payload.error,
        }));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setDownloadState((prev) => ({
          ...prev,
          status: 'idle',
          error: 'Download cancelled',
        }));
      } else {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSaveFile = () => {
    if (!downloadState.file) return;

    // Create a download link and trigger it
    const url = URL.createObjectURL(downloadState.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadState.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="download-demo">
      <h1>File Download Demo</h1>
      <p className="description">
        Download files with real-time progress tracking. The download endpoint returns binary files
        with proper Content-Type and Content-Disposition headers.
      </p>

      <div className="download-section">
        <h3>Select File to Download</h3>
        <div className="file-selector">
          <select value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="doc-1">Text Document (hello.txt)</option>
            <option value="doc-2">JSON File (data.json)</option>
            <option value="non-existent">Non-existent File (404 test)</option>
          </select>

          {downloadState.status === 'downloading' ? (
            <button type="button" onClick={handleCancel} className="cancel-button">
              Cancel
            </button>
          ) : (
            <button type="button" onClick={handleDownload}>
              Download
            </button>
          )}
        </div>
      </div>

      {downloadState.status === 'downloading' && (
        <div className="progress-section">
          <h3>Download Progress</h3>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${downloadState.progress}%` }} />
          </div>
          <div className="progress-info">
            <span>{downloadState.progress.toFixed(1)}%</span>
            <span>
              {formatBytes(downloadState.loaded)}
              {downloadState.total > 0 && ` / ${formatBytes(downloadState.total)}`}
            </span>
          </div>
        </div>
      )}

      {downloadState.status === 'success' && downloadState.file && (
        <div className="success-section">
          <h3>Download Complete!</h3>
          <div className="file-info">
            <div className="file-detail">
              <span className="label">Filename:</span>
              <span className="value">{downloadState.file.name}</span>
            </div>
            <div className="file-detail">
              <span className="label">Size:</span>
              <span className="value">{formatBytes(downloadState.file.size)}</span>
            </div>
            <div className="file-detail">
              <span className="label">Type:</span>
              <span className="value">{downloadState.file.type || 'Unknown'}</span>
            </div>
          </div>
          <button type="button" onClick={handleSaveFile} className="save-button">
            Save to Disk
          </button>
        </div>
      )}

      {downloadState.status === 'error' && (
        <div className="error-section">
          <h3>Download Failed</h3>
          <div className="error">{downloadState.error}</div>
        </div>
      )}

      {downloadState.error && downloadState.status === 'idle' && (
        <div className="info-section">
          <div className="info">{downloadState.error}</div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// TanStack Router Setup
// ===========================================

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        <nav className="nav-bar">
          <div className="nav-content">
            <Link to="/" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              Users API
            </Link>
            <Link to="/chat" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              WebSocket Chat
            </Link>
            <Link to="/ai" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              AI Streaming
            </Link>
            <Link to="/logs" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              Live Logs
            </Link>
            <Link
              to="/downloads"
              className="nav-link"
              activeProps={{ className: 'nav-link active' }}
            >
              Downloads
            </Link>
          </div>
        </nav>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: UsersDemo,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatDemo,
});

const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  component: AIStreamingDemo,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsDemo,
});

const downloadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/downloads',
  component: DownloadDemo,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatRoute,
  aiRoute,
  logsRoute,
  downloadsRoute,
]);

const router = createRouter({ routeTree });

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// ===========================================
// Main App Component
// ===========================================

export function App() {
  return <RouterProvider router={router} />;
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
