/**
 * Streaming Contract Example
 *
 * This example demonstrates how to define a streaming endpoint contract
 * for AI-style text generation using NDJSON format.
 */

import { defineContract } from '@richie-rpc/core';
import { z } from 'zod';

export const streamingContract = defineContract({
  /**
   * AI text generation endpoint that streams tokens back to the client.
   * Uses NDJSON (Newline Delimited JSON) for the response format.
   */
  generateText: {
    type: 'streaming',
    method: 'POST',
    path: '/ai/generate',
    body: z.object({
      prompt: z.string().min(1, 'Prompt is required'),
      maxTokens: z.number().int().positive().optional().default(100),
      temperature: z.number().min(0).max(2).optional().default(0.7),
    }),
    // Each chunk streamed back to the client
    chunk: z.object({
      text: z.string(),
      tokenIndex: z.number().int(),
    }),
    // Final response sent when stream completes
    finalResponse: z.object({
      totalTokens: z.number().int(),
      completionTime: z.number(), // milliseconds
      finishReason: z.enum(['completed', 'max_tokens', 'error']),
    }),
  },

  /**
   * Code completion endpoint with streaming response.
   */
  completeCode: {
    type: 'streaming',
    method: 'POST',
    path: '/ai/complete-code',
    body: z.object({
      code: z.string(),
      language: z.enum(['typescript', 'javascript', 'python', 'rust']),
      cursorPosition: z.number().int().nonnegative(),
    }),
    chunk: z.object({
      text: z.string(),
      confidence: z.number().min(0).max(1),
    }),
    finalResponse: z.object({
      totalSuggestions: z.number().int(),
      completionTime: z.number(),
    }),
  },
});

export type StreamingContract = typeof streamingContract;
