/**
 * Server-Sent Events (SSE) Contract Example
 *
 * This example demonstrates how to define SSE endpoints for
 * one-way server-to-client event streaming.
 */

import { defineContract } from '@richie-rpc/core';
import { z } from 'zod';

export const sseContract = defineContract({
  /**
   * Real-time log streaming endpoint.
   * Clients can filter by log level.
   */
  logs: {
    type: 'sse',
    method: 'GET',
    path: '/logs',
    query: z.object({
      level: z.enum(['info', 'warn', 'error', 'all']).optional().default('all'),
      source: z.string().optional(),
    }),
    events: {
      log: z.object({
        timestamp: z.string(),
        level: z.enum(['info', 'warn', 'error']),
        message: z.string(),
        source: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
      heartbeat: z.object({
        timestamp: z.string(),
        connectionId: z.string(),
      }),
    },
  },

  /**
   * Stock price ticker endpoint.
   * Streams real-time price updates.
   */
  stockTicker: {
    type: 'sse',
    method: 'GET',
    path: '/stocks/:symbol/ticker',
    params: z.object({
      symbol: z.string().toUpperCase(),
    }),
    events: {
      price: z.object({
        symbol: z.string(),
        price: z.number(),
        change: z.number(),
        changePercent: z.number(),
        volume: z.number(),
        timestamp: z.string(),
      }),
      trade: z.object({
        symbol: z.string(),
        price: z.number(),
        quantity: z.number(),
        side: z.enum(['buy', 'sell']),
        timestamp: z.string(),
      }),
      marketStatus: z.object({
        isOpen: z.boolean(),
        nextChange: z.string(),
      }),
    },
  },

  /**
   * Notification stream for a user.
   */
  notifications: {
    type: 'sse',
    method: 'GET',
    path: '/users/:userId/notifications',
    params: z.object({
      userId: z.string(),
    }),
    query: z.object({
      types: z.string().optional(), // comma-separated list
    }),
    events: {
      notification: z.object({
        id: z.string(),
        type: z.enum(['message', 'alert', 'reminder', 'system']),
        title: z.string(),
        body: z.string(),
        read: z.boolean(),
        createdAt: z.string(),
      }),
      badge: z.object({
        unreadCount: z.number(),
      }),
    },
  },
});

export type SSEContract = typeof sseContract;
