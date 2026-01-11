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
 * Typed WebSocket wrapper for sending messages
 */
export interface TypedServerWebSocket<
  T extends WebSocketContractDefinition,
  WS extends GenericWebSocket,
> {
  /** The underlying Bun WebSocket */
  readonly raw: WS;
  /** Send a typed message to the client */
  send<K extends keyof T['serverMessages']>(
    type: K,
    payload: z.infer<T['serverMessages'][K]['payload']>,
  ): void;
  /** Close the connection */
  close(code?: number, reason?: string): void;
}

export type GenericWebSocket = {
  send: (message: string) => void;
  close: (code?: number, reason?: string) => void;
};

/**
 * Arguments passed to handler functions
 */
export interface HandlerArgs<
  T extends WebSocketContractDefinition,
  WS extends GenericWebSocket,
  D = unknown,
> {
  ws: TypedServerWebSocket<T, WS>;
  params: ExtractWSParams<T>;
  query: ExtractWSQuery<T>;
  headers: ExtractWSHeaders<T>;
  data: D;
}

/**
 * Handler functions for a WebSocket endpoint
 */
export interface WebSocketEndpointHandlers<
  T extends WebSocketContractDefinition,
  WS extends GenericWebSocket,
  D = unknown,
> {
  /** Called when connection opens */
  open?(args: HandlerArgs<T, WS, D>): void | Promise<void>;
  /** Called for each validated message */
  message(args: HandlerArgs<T, WS, D> & { message: ExtractClientMessage<T> }): void | Promise<void>;
  /** Called when connection closes */
  close?(args: HandlerArgs<T, WS, D>): void;
  /** Called on backpressure drain */
  drain?(args: HandlerArgs<T, WS, D>): void;
  /** Called when message validation fails */
  validationError?(args: {
    ws: TypedServerWebSocket<T, WS>;
    error: WebSocketValidationError;
    data: D;
  }): void;
}

/**
 * Contract handlers mapping for WebSocket endpoints
 */
export type WebSocketContractHandlers<
  T extends WebSocketContract,
  WS extends GenericWebSocket,
  D = unknown,
> = {
  [K in keyof T]: WebSocketEndpointHandlers<T[K], WS, D>;
};

/**
 * Upgrade data returned by matchAndPrepareUpgrade
 */
export interface UpgradeData {
  endpointName: string;
  endpoint: WebSocketContractDefinition;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
}

/**
 * Options for WebSocket router
 */
export interface WebSocketRouterOptions<WS extends GenericWebSocket, D = unknown> {
  basePath?: string;
  dataSchema?: z.ZodSchema<D>;
  rawWebSocket?: WS;
}

type WithData<T, D> = T &
  (D extends object | string | number | boolean
    ? {
        data: D;
      }
    : {
        data?: never;
      });

/**
 * WebSocket handler interface with context parameter
 */
export interface WebSocketHandler<WS extends GenericWebSocket, D = unknown> {
  open(
    args: WithData<
      {
        ws: WS;
        upgradeData: UpgradeData;
      },
      D
    >,
  ): void | Promise<void>;
  message(
    args: WithData<
      {
        ws: WS;
        rawMessage: string | Buffer<ArrayBuffer>;
        upgradeData: UpgradeData;
      },
      D
    >,
  ): void | Promise<void>;
  close(
    args: WithData<
      {
        ws: WS;
        code: number;
        reason: string;
        upgradeData: UpgradeData;
      },
      D
    >,
  ): void;
  drain(args: WithData<{ ws: WS; upgradeData: UpgradeData }, D>): void;
}

/**
 * Create a typed WebSocket wrapper
 */
function createTypedWebSocket<T extends WebSocketContractDefinition, WS extends GenericWebSocket>(
  ws: WS,
): TypedServerWebSocket<T, WS> {
  return {
    get raw() {
      return ws;
    },
    send(type, payload) {
      ws.send(JSON.stringify({ type, payload }));
    },
    close(code, reason) {
      ws.close(code, reason);
    },
  };
}

/**
 * WebSocket router for managing WebSocket contract endpoints
 */
export class WebSocketRouter<
  T extends WebSocketContract,
  WS extends GenericWebSocket,
  D = unknown,
> {
  private basePath: string;
  private dataSchema?: z.ZodSchema<D>;

  constructor(
    private contract: T,
    private handlers: WebSocketContractHandlers<T, WS, D>,
    options?: WebSocketRouterOptions<WS, D>,
  ) {
    // Normalize basePath
    const bp = options?.basePath || '';
    if (bp) {
      this.basePath = bp.startsWith('/') ? bp : `/${bp}`;
      this.basePath = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
    } else {
      this.basePath = '';
    }
    this.dataSchema = options?.dataSchema;
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
  async matchAndPrepareUpgrade(request: Request): Promise<UpgradeData | null> {
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

      return {
        endpointName: String(name),
        endpoint,
        params,
        query,
        headers,
      };
    } catch (err) {
      // Validation failed during upgrade
      console.error('WebSocket upgrade validation failed:', err);
      return null;
    }
  }

  /**
   * Validate data against dataSchema if provided
   */
  private validateData(data: unknown): D {
    if (this.dataSchema) {
      const result = this.dataSchema.safeParse(data);
      if (!result.success) {
        throw new WebSocketValidationError('data', result.error.issues);
      }
      return result.data;
    }
    return data as D;
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
   * Get WebSocket handler that accepts context as parameter
   */
  get websocketHandler(): WebSocketHandler<WS, D> {
    return {
      open: async ({ ws, upgradeData, data }) => {
        const endpointHandlers = this.handlers[upgradeData.endpointName as keyof T];
        if (!endpointHandlers) return;

        // Validate data if schema provided
        const validatedData = this.validateData(data);

        const typedWs = createTypedWebSocket<WebSocketContractDefinition, WS>(ws);

        if (endpointHandlers.open) {
          await endpointHandlers.open({
            ws: typedWs,
            params: upgradeData.params as any,
            query: upgradeData.query as any,
            headers: upgradeData.headers as any,
            data: validatedData,
          });
        }
      },

      message: async ({ ws, rawMessage, upgradeData, data }) => {
        const endpointHandlers = this.handlers[upgradeData.endpointName as keyof T];
        if (!endpointHandlers) return;

        const validatedData = this.validateData(data);
        const typedWs = createTypedWebSocket<WebSocketContractDefinition, WS>(ws);

        try {
          // Validate the message
          const validatedMessage = this.validateMessage(
            upgradeData.endpoint,
            typeof rawMessage === 'string' ? rawMessage : rawMessage.buffer,
          );

          // Call handler with validated message
          await endpointHandlers.message({
            ws: typedWs as any,
            message: validatedMessage as any,
            params: upgradeData.params as any,
            query: upgradeData.query as any,
            headers: upgradeData.headers as any,
            data: validatedData,
          });
        } catch (err) {
          if (err instanceof WebSocketValidationError) {
            // Call validation error handler if provided
            if (endpointHandlers.validationError) {
              endpointHandlers.validationError({
                ws: typedWs as any,
                error: err,
                data: validatedData,
              });
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

      close: ({ ws, upgradeData, data }) => {
        const endpointHandlers = this.handlers[upgradeData.endpointName as keyof T];
        if (!endpointHandlers) return;

        const validatedData = this.validateData(data);
        const typedWs = createTypedWebSocket<WebSocketContractDefinition, WS>(ws);

        if (endpointHandlers.close) {
          endpointHandlers.close({
            ws: typedWs as any,
            params: upgradeData.params as any,
            query: upgradeData.query as any,
            headers: upgradeData.headers as any,
            data: validatedData,
          });
        }
      },

      drain: ({ ws, upgradeData, data }) => {
        const endpointHandlers = this.handlers[upgradeData.endpointName as keyof T];
        if (!endpointHandlers) return;

        const validatedData = this.validateData(data);
        const typedWs = createTypedWebSocket<WebSocketContractDefinition, WS>(ws);

        if (endpointHandlers.drain) {
          endpointHandlers.drain({
            ws: typedWs as any,
            params: upgradeData.params as any,
            query: upgradeData.query as any,
            headers: upgradeData.headers as any,
            data: validatedData,
          });
        }
      },
    };
  }
}

/**
 * Create a WebSocket router from a contract and handlers
 */
export function createWebSocketRouter<
  T extends WebSocketContract,
  WS extends GenericWebSocket,
  D = unknown,
>(
  contract: T,
  handlers: WebSocketContractHandlers<T, WS, D>,
  options?: WebSocketRouterOptions<WS, D>,
): WebSocketRouter<T, WS, D> {
  return new WebSocketRouter(contract, handlers, options);
}
