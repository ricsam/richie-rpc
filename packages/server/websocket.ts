import type {
  ExtractClientMessage,
  ExtractWSHeaders,
  ExtractWSParams,
  ExtractWSQuery,
  WebSocketContract,
  WebSocketContractDefinition,
} from '@richie-rpc/core';
import { matchPath, parseQuery } from '@richie-rpc/core';
import type { z } from 'zod';

/**
 * Validation error for WebSocket messages
 */
export class WebSocketValidationError extends Error {
  constructor(
    public messageType: string,
    public issues: z.ZodIssue[],
  ) {
    super(`Validation failed for WebSocket message type: ${messageType}`);
    this.name = 'WebSocketValidationError';
  }
}

/**
 * Data attached to WebSocket connections for routing
 */
export interface WebSocketData<
  T extends WebSocketContractDefinition = WebSocketContractDefinition,
  S = unknown,
> {
  endpointName: string;
  endpoint: T;
  params: ExtractWSParams<T>;
  query: ExtractWSQuery<T>;
  headers: ExtractWSHeaders<T>;
  context: unknown;
  state: S;
}

/**
 * Typed WebSocket wrapper for sending messages
 */
export interface TypedServerWebSocket<T extends WebSocketContractDefinition, S = unknown> {
  /** The underlying Bun WebSocket */
  readonly raw: WebSocket;
  /** Send a typed message to the client */
  send<K extends keyof T['serverMessages']>(
    type: K,
    payload: z.infer<T['serverMessages'][K]['payload']>,
  ): void;
  /** Subscribe to a topic for pub/sub */
  subscribe(topic: string): void;
  /** Unsubscribe from a topic */
  unsubscribe(topic: string): void;
  /** Publish a message to a topic */
  publish<K extends keyof T['serverMessages']>(
    topic: string,
    type: K,
    payload: z.infer<T['serverMessages'][K]['payload']>,
  ): void;
  /** Close the connection */
  close(code?: number, reason?: string): void;
  /** Connection data */
  readonly data: WebSocketData<T, S>;
}

/**
 * Handler functions for a WebSocket endpoint
 */
export interface WebSocketEndpointHandlers<
  T extends WebSocketContractDefinition,
  C = unknown,
  S = unknown,
> {
  /** Called when connection opens */
  open?(ws: TypedServerWebSocket<T, S>, ctx: C): void | Promise<void>;
  /** Called for each validated message */
  message(
    ws: TypedServerWebSocket<T, S>,
    message: ExtractClientMessage<T>,
    ctx: C,
  ): void | Promise<void>;
  /** Called when connection closes */
  close?(ws: TypedServerWebSocket<T, S>, ctx: C): void;
  /** Called when message validation fails */
  validationError?(ws: TypedServerWebSocket<T, S>, error: WebSocketValidationError, ctx: C): void;
}

/**
 * Contract handlers mapping for WebSocket endpoints
 */
export type WebSocketContractHandlers<T extends WebSocketContract, C = unknown, S = unknown> = {
  [K in keyof T]: WebSocketEndpointHandlers<T[K], C, S>;
};

/**
 * Upgrade data returned by matchAndPrepareUpgrade
 */
export interface UpgradeData<S = unknown> {
  endpointName: string;
  endpoint: WebSocketContractDefinition;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  context: unknown;
  state: S;
}

/**
 * Options for WebSocket router
 */
export interface WebSocketRouterOptions<C = unknown, S = unknown> {
  basePath?: string;
  context?: (
    request: Request,
    endpointName: string,
    endpoint: WebSocketContractDefinition,
  ) => C | Promise<C>;
  /** Type hint for per-connection state. Use `{} as YourStateType` */
  state?: S;
}

/**
 * Bun WebSocket handler type (subset of Bun's types)
 */
export interface BunWebSocketHandler<T = unknown> {
  open(ws: Bun.ServerWebSocket<T>): void | Promise<void>;
  message(ws: Bun.ServerWebSocket<T>, message: string | Buffer<ArrayBuffer>): void | Promise<void>;
  close(ws: Bun.ServerWebSocket<T>, code: number, reason: string): void;
  drain(ws: Bun.ServerWebSocket<T>): void;
}

/**
 * Create a typed WebSocket wrapper
 */
function createTypedWebSocket<T extends WebSocketContractDefinition, S = unknown>(
  ws: WebSocket & { data: WebSocketData<T, S> },
): TypedServerWebSocket<T, S> {
  return {
    get raw() {
      return ws;
    },
    send(type, payload) {
      ws.send(JSON.stringify({ type, payload }));
    },
    subscribe(topic) {
      (ws as any).subscribe(topic);
    },
    unsubscribe(topic) {
      (ws as any).unsubscribe(topic);
    },
    publish(topic, type, payload) {
      (ws as any).publish(topic, JSON.stringify({ type, payload }));
    },
    close(code, reason) {
      ws.close(code, reason);
    },
    get data() {
      return ws.data;
    },
  };
}

/**
 * WebSocket router for managing WebSocket contract endpoints
 */
export class WebSocketRouter<T extends WebSocketContract, C = unknown, S = unknown> {
  private basePath: string;
  private contextFactory?: (
    request: Request,
    endpointName: string,
    endpoint: WebSocketContractDefinition,
  ) => C | Promise<C>;

  constructor(
    private contract: T,
    private handlers: WebSocketContractHandlers<T, C, S>,
    options?: WebSocketRouterOptions<C, S>,
  ) {
    // Normalize basePath
    const bp = options?.basePath || '';
    if (bp) {
      this.basePath = bp.startsWith('/') ? bp : `/${bp}`;
      this.basePath = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
    } else {
      this.basePath = '';
    }
    this.contextFactory = options?.context;
  }

  /**
   * Find matching endpoint for a path
   */
  private findEndpoint(path: string): {
    name: keyof T;
    endpoint: WebSocketContractDefinition;
    params: Record<string, string>;
  } | null {
    for (const [name, endpoint] of Object.entries(this.contract)) {
      const params = matchPath(endpoint.path, path);
      if (params !== null) {
        return {
          name,
          endpoint: endpoint as WebSocketContractDefinition,
          params,
        };
      }
    }
    return null;
  }

  /**
   * Parse and validate upgrade request parameters
   */
  private parseUpgradeParams(
    request: Request,
    endpoint: WebSocketContractDefinition,
    pathParams: Record<string, string>,
  ): { params: any; query: any; headers: any } {
    const url = new URL(request.url);

    // Parse and validate path params
    let params: any = pathParams;
    if (endpoint.params) {
      const result = endpoint.params.safeParse(pathParams);
      if (!result.success) {
        throw new Error(`Invalid path params: ${result.error.message}`);
      }
      params = result.data;
    }

    // Parse and validate query params
    let query: any = {};
    if (endpoint.query) {
      const queryData = parseQuery(url.searchParams);
      const result = endpoint.query.safeParse(queryData);
      if (!result.success) {
        throw new Error(`Invalid query params: ${result.error.message}`);
      }
      query = result.data;
    }

    // Parse and validate headers
    let headers: any = {};
    if (endpoint.headers) {
      const headersObj: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      const result = endpoint.headers.safeParse(headersObj);
      if (!result.success) {
        throw new Error(`Invalid headers: ${result.error.message}`);
      }
      headers = result.data;
    }

    return { params, query, headers };
  }

  /**
   * Match a request and prepare upgrade data
   * Returns null if no match, or UpgradeData for server.upgrade()
   */
  async matchAndPrepareUpgrade(request: Request): Promise<UpgradeData<S> | null> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Strip basePath if configured
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.slice(this.basePath.length) || '/';
    }

    const match = this.findEndpoint(path);
    if (!match) {
      return null;
    }

    const { name, endpoint, params: rawParams } = match;

    try {
      const { params, query, headers } = this.parseUpgradeParams(request, endpoint, rawParams);

      // Create context if factory provided
      const context = this.contextFactory
        ? await this.contextFactory(request, String(name), endpoint)
        : (undefined as C);

      return {
        endpointName: String(name),
        endpoint,
        params,
        query,
        headers,
        context,
        state: {} as S,
      };
    } catch (err) {
      // Validation failed during upgrade
      console.error('WebSocket upgrade validation failed:', err);
      return null;
    }
  }

  /**
   * Validate an incoming client message
   */
  private validateMessage(
    endpoint: WebSocketContractDefinition,
    rawMessage: string | ArrayBuffer,
  ): ExtractClientMessage<typeof endpoint> {
    // Parse message
    const messageStr =
      typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage);
    const parsed = JSON.parse(messageStr) as { type: string; payload: unknown };

    const { type, payload } = parsed;

    // Find the schema for this message type
    const messageDef = endpoint.clientMessages[type];
    if (!messageDef) {
      throw new WebSocketValidationError(type, [
        {
          code: 'custom',
          path: ['type'],
          message: `Unknown message type: ${type}`,
        },
      ]);
    }

    // Validate payload
    const result = messageDef.payload.safeParse(payload);
    if (!result.success) {
      throw new WebSocketValidationError(type, result.error.issues);
    }

    return { type, payload: result.data } as ExtractClientMessage<typeof endpoint>;
  }

  /**
   * Get Bun-compatible WebSocket handler
   */
  get websocketHandler(): BunWebSocketHandler<UpgradeData<S>> {
    return {
      open: async (ws) => {
        const data = ws.data;
        const endpointHandlers = this.handlers[data.endpointName as keyof T];
        if (!endpointHandlers) return;

        // Create typed wrapper with properly typed data
        const typedWs = createTypedWebSocket(
          ws as unknown as WebSocket & {
            data: WebSocketData<WebSocketContractDefinition, S>;
          },
        );

        if (endpointHandlers.open) {
          await endpointHandlers.open(typedWs as any, data.context as C);
        }
      },

      message: async (ws, message) => {
        const data = ws.data;
        const endpointHandlers = this.handlers[data.endpointName as keyof T];
        if (!endpointHandlers) return;

        const typedWs = createTypedWebSocket(
          ws as unknown as WebSocket & {
            data: WebSocketData<WebSocketContractDefinition, S>;
          },
        );

        try {
          // Validate the message
          const validatedMessage = this.validateMessage(
            data.endpoint,
            typeof message === 'string' ? message : message.buffer,
          );

          // Call handler with validated message
          await endpointHandlers.message(
            typedWs as any,
            validatedMessage as any,
            data.context as C,
          );
        } catch (err) {
          if (err instanceof WebSocketValidationError) {
            // Call validation error handler if provided
            if (endpointHandlers.validationError) {
              endpointHandlers.validationError(typedWs as any, err, data.context as C);
            } else {
              // Default: send error message back
              typedWs.send(
                'error' as any,
                {
                  code: 'VALIDATION_ERROR',
                  message: err.message,
                  issues: err.issues,
                } as any,
              );
            }
          } else {
            console.error('WebSocket message handler error:', err);
          }
        }
      },

      close: (ws, _code, _reason) => {
        const data = ws.data;
        const endpointHandlers = this.handlers[data.endpointName as keyof T];
        if (!endpointHandlers) return;

        const typedWs = createTypedWebSocket(
          ws as unknown as WebSocket & {
            data: WebSocketData<WebSocketContractDefinition, S>;
          },
        );

        if (endpointHandlers.close) {
          endpointHandlers.close(typedWs as any, data.context as C);
        }
      },
      drain: () => {
        // not used
      },
    };
  }
}

/**
 * Create a WebSocket router from a contract and handlers
 */
export function createWebSocketRouter<T extends WebSocketContract, C = unknown, S = unknown>(
  contract: T,
  handlers: WebSocketContractHandlers<T, C, S>,
  options?: WebSocketRouterOptions<C, S>,
): WebSocketRouter<T, C, S> {
  return new WebSocketRouter(contract, handlers, options);
}
