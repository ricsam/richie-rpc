import { defineContract } from '@richie-rpc/core';
import { z } from 'zod';

export const streamingContract = defineContract({
  aiChat: {
    type: 'streaming',
    method: 'POST',
    path: '/ai/chat',
    body: z.object({ prompt: z.string() }),
    chunk: z.object({ text: z.string() }),
    finalResponse: z.object({
      totalTokens: z.number(),
      completionTime: z.number(),
    }),
  },

  logs: {
    type: 'sse',
    method: 'GET',
    path: '/logs',
    query: z.object({
      level: z.enum(['info', 'warn', 'error', 'all']).optional(),
    }),
    events: {
      log: z.object({
        timestamp: z.string(),
        level: z.enum(['info', 'warn', 'error']),
        message: z.string(),
        source: z.string().optional(),
      }),
      heartbeat: z.object({ timestamp: z.string() }),
    },
  },
});
