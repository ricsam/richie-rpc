/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ExtractClientMessagePayload,
  ExtractServerMessage,
  ExtractServerMessagePayload,
  ExtractWSHeaders,
  ExtractWSParams,
  ExtractWSQuery,
  WebSocketContract,
  WebSocketContractDefinition,
} from '@richie-rpc/core';
import { buildUrl, interpolatePath } from '@richie-rpc/core';

/**
 * Validation error for WebSocket messages
 */
export class WebSocketClientValidationError extends Error {
  constructor(
    public messageType: string,
    public issues: unknown[],
  ) {
    super(`Validation failed for WebSocket message type: ${messageType}`);
    this.name = 'WebSocketClientValidationError';
  }
}

/**
 * Options for creating a WebSocket connection
 */
export type WebSocketConnectionOptions<T extends WebSocketContractDefinition> = {
  params?: ExtractWSParams<T> extends never ? never : ExtractWSParams<T>;
  query?: ExtractWSQuery<T> extends never ? never : ExtractWSQuery<T>;
  headers?: ExtractWSHeaders<T> extends never ? never : ExtractWSHeaders<T>;
};

/**
 * Typed WebSocket connection interface
 */
export interface TypedWebSocket<T extends WebSocketContractDefinition> {
  /** Connect to WebSocket server, returns disconnect function */
  connect(): () => void;

  /** Send a typed message (validates before sending) */
  send<K extends keyof T['clientMessages']>(
    type: K,
    payload: ExtractClientMessagePayload<T, K>,
  ): void;

  /** Subscribe to specific message type, returns unsubscribe function */
  on<K extends keyof T['serverMessages']>(
    type: K,
    handler: (payload: ExtractServerMessagePayload<T, K>) => void,
  ): () => void;

  /** Subscribe to all messages, returns unsubscribe function */
  onMessage(handler: (message: ExtractServerMessage<T>) => void): () => void;

  /** Subscribe to connection state changes */
  onStateChange(handler: (connected: boolean) => void): () => void;

  /** Subscribe to connection errors (network failures, etc.) */
  onError(handler: (error: Error) => void): () => void;

  /** Current connection state */
  readonly connected: boolean;
}

/**
 * WebSocket client type for a contract
 */
export type WebSocketClient<T extends WebSocketContract> = {
  [K in keyof T]: (options?: WebSocketConnectionOptions<T[K]>) => TypedWebSocket<T[K]>;
};

/**
 * WebSocket client configuration
 */
export interface WebSocketClientConfig {
  /** Base URL for WebSocket connections (ws:// or wss://) */
  baseUrl: string;
}

/**
 * Create a typed WebSocket connection for a specific endpoint
 */
function createTypedWebSocket<T extends WebSocketContractDefinition>(
  endpoint: T,
  url: string,
): TypedWebSocket<T> {
  let ws: WebSocket | null = null;
  let isConnected = false;

  type MessageHandler = (message: ExtractServerMessage<T>) => void;
  type TypedHandler<K extends keyof T['serverMessages']> = (
    payload: ExtractServerMessagePayload<T, K>,
  ) => void;
  type StateHandler = (connected: boolean) => void;
  type ErrorHandler = (error: Error) => void;

  const messageListeners = new Set<MessageHandler>();
  const typedListeners: Record<string, Set<TypedHandler<any>>> = {};
  const stateListeners = new Set<StateHandler>();
  const errorListeners = new Set<ErrorHandler>();

  // Initialize typed listener sets for each server message type
  for (const type of Object.keys(endpoint.serverMessages)) {
    typedListeners[type] = new Set();
  }

  function notifyStateChange(connected: boolean) {
    isConnected = connected;
    stateListeners.forEach((h) => h(connected));
  }

  function notifyError(error: Error) {
    errorListeners.forEach((h) => h(error));
  }

  function handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as ExtractServerMessage<T>;

      // Notify all-message listeners
      messageListeners.forEach((h) => h(message));

      // Notify type-specific listeners
      const { type, payload } = message as { type: string; payload: unknown };
      if (typedListeners[type]) {
        typedListeners[type].forEach((h) => h(payload as any));
      }
    } catch (err) {
      notifyError(new Error(`Failed to parse WebSocket message: ${(err as Error).message}`));
    }
  }

  return {
    connect() {
      if (ws) {
        // Already connected or connecting
        return () => {
          ws?.close();
          ws = null;
        };
      }

      ws = new WebSocket(url);

      ws.onopen = () => {
        notifyStateChange(true);
      };

      ws.onclose = () => {
        notifyStateChange(false);
        ws = null;
      };

      ws.onerror = () => {
        notifyError(new Error('WebSocket connection error'));
      };

      ws.onmessage = handleMessage;

      // Return disconnect function
      return () => {
        ws?.close();
        ws = null;
      };
    },

    send(type, payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }

      // Validate payload against schema
      const messageDef = endpoint.clientMessages[type as string];
      if (messageDef && messageDef.payload) {
        const result = messageDef.payload.safeParse(payload);
        if (!result.success) {
          throw new WebSocketClientValidationError(type as string, result.error.issues);
        }
      }

      // Send message
      ws.send(JSON.stringify({ type, payload }));
    },

    on(type, handler) {
      const typeStr = type as string;
      if (!typedListeners[typeStr]) {
        typedListeners[typeStr] = new Set();
      }
      typedListeners[typeStr].add(handler);
      return () => typedListeners[typeStr]?.delete(handler);
    },

    onMessage(handler) {
      messageListeners.add(handler);
      return () => messageListeners.delete(handler);
    },

    onStateChange(handler) {
      stateListeners.add(handler);
      return () => stateListeners.delete(handler);
    },

    onError(handler) {
      errorListeners.add(handler);
      return () => errorListeners.delete(handler);
    },

    get connected() {
      return isConnected;
    },
  };
}

/**
 * Resolve HTTP URL to WebSocket URL
 */
function resolveWebSocketUrl(baseUrl: string): string {
  // If already a WebSocket URL, return as-is
  if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
    return baseUrl;
  }

  // Convert http:// to ws:// and https:// to wss://
  if (baseUrl.startsWith('http://')) {
    return `ws://${baseUrl.slice(7)}`;
  }
  if (baseUrl.startsWith('https://')) {
    return `wss://${baseUrl.slice(8)}`;
  }

  // If relative URL, resolve using window.location
  if (baseUrl.startsWith('/')) {
    const g = globalThis as unknown as { location?: { protocol?: string; host?: string } };
    if (g?.location) {
      const protocol = g.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${g.location.host}${baseUrl}`;
    }
    return `ws://localhost${baseUrl}`;
  }

  // Assume ws:// by default
  return `ws://${baseUrl}`;
}

/**
 * Create a typed WebSocket client for a contract
 *
 * @param contract - The WebSocket contract definition
 * @param config - Client configuration with baseUrl
 * @returns Client object with methods for each endpoint
 *
 * @example
 * ```typescript
 * const wsContract = defineWebSocketContract({
 *   chat: {
 *     path: '/ws/chat/:roomId',
 *     params: z.object({ roomId: z.string() }),
 *     clientMessages: {
 *       sendMessage: { payload: z.object({ text: z.string() }) },
 *     },
 *     serverMessages: {
 *       message: { payload: z.object({ userId: z.string(), text: z.string() }) },
 *     },
 *   },
 * });
 *
 * const wsClient = createWebSocketClient(wsContract, { baseUrl: 'ws://localhost:3000' });
 *
 * // Create connection instance
 * const chat = wsClient.chat({ params: { roomId: 'room1' } });
 *
 * // Connect and get disconnect function
 * const disconnect = chat.connect();
 *
 * // Subscribe to state changes
 * chat.onStateChange((connected) => {
 *   console.log('Connected:', connected);
 * });
 *
 * // Subscribe to specific message types
 * chat.on('message', (payload) => {
 *   console.log(`${payload.userId}: ${payload.text}`);
 * });
 *
 * // Send messages
 * chat.send('sendMessage', { text: 'Hello!' });
 *
 * // Disconnect when done
 * disconnect();
 * ```
 */
export function createWebSocketClient<T extends WebSocketContract>(
  contract: T,
  config: WebSocketClientConfig,
): WebSocketClient<T> {
  const resolvedBaseUrl = resolveWebSocketUrl(config.baseUrl);

  const client: Record<string, unknown> = {};

  for (const [name, endpoint] of Object.entries(contract)) {
    client[name] = (options: WebSocketConnectionOptions<WebSocketContractDefinition> = {}) => {
      // Build URL
      let path = endpoint.path;
      if (options.params) {
        path = interpolatePath(path, options.params as Record<string, string | number>);
      }

      const url = buildUrl(
        resolvedBaseUrl,
        path,
        options.query as Record<string, string | number | boolean | string[]> | undefined,
      );

      return createTypedWebSocket(endpoint, url);
    };
  }

  return client as WebSocketClient<T>;
}
