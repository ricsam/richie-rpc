import type { z } from 'zod';

/**
 * Definition for a single message type in WebSocket communication
 */
export interface WebSocketMessageDefinition {
  payload: z.ZodTypeAny;
}

/**
 * Definition for a WebSocket endpoint contract
 */
export interface WebSocketContractDefinition {
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  headers?: z.ZodTypeAny;

  /** Messages client sends to server (validated with Zod on server) */
  clientMessages: Record<string, WebSocketMessageDefinition>;

  /** Messages server sends to client (type inference only, NOT validated) */
  serverMessages: Record<string, WebSocketMessageDefinition>;
}

/**
 * A collection of named WebSocket endpoints
 */
export type WebSocketContract = Record<string, WebSocketContractDefinition>;

/**
 * Extract the union type of all client messages for a WebSocket endpoint
 */
export type ExtractClientMessage<T extends WebSocketContractDefinition> = {
  [K in keyof T['clientMessages']]: {
    type: K;
    payload: z.infer<T['clientMessages'][K]['payload']>;
  };
}[keyof T['clientMessages']];

/**
 * Extract the union type of all server messages for a WebSocket endpoint
 */
export type ExtractServerMessage<T extends WebSocketContractDefinition> = {
  [K in keyof T['serverMessages']]: {
    type: K;
    payload: z.infer<T['serverMessages'][K]['payload']>;
  };
}[keyof T['serverMessages']];

/**
 * Extract the payload type for a specific client message
 */
export type ExtractClientMessagePayload<
  T extends WebSocketContractDefinition,
  K extends keyof T['clientMessages'],
> = z.infer<T['clientMessages'][K]['payload']>;

/**
 * Extract the payload type for a specific server message
 */
export type ExtractServerMessagePayload<
  T extends WebSocketContractDefinition,
  K extends keyof T['serverMessages'],
> = z.infer<T['serverMessages'][K]['payload']>;

/**
 * Extract params type from WebSocket endpoint
 */
export type ExtractWSParams<T extends WebSocketContractDefinition> =
  T['params'] extends z.ZodTypeAny ? z.infer<T['params']> : never;

/**
 * Extract query type from WebSocket endpoint
 */
export type ExtractWSQuery<T extends WebSocketContractDefinition> = T['query'] extends z.ZodTypeAny
  ? z.infer<T['query']>
  : never;

/**
 * Extract headers type from WebSocket endpoint
 */
export type ExtractWSHeaders<T extends WebSocketContractDefinition> =
  T['headers'] extends z.ZodTypeAny ? z.infer<T['headers']> : never;

/**
 * Type helper to ensure a value is a valid WebSocket contract
 */
export function defineWebSocketContract<T extends WebSocketContract>(contract: T): T {
  return contract;
}
