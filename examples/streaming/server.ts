/**
 * Streaming Server Example
 *
 * This example demonstrates how to implement streaming handlers
 * that send NDJSON chunks to the client.
 */

import { createRouter } from '@richie-rpc/server';
import { streamingContract } from './contract';

// Simulated AI token generation (replace with actual AI SDK)
async function* generateTokens(
  prompt: string,
  maxTokens: number
): AsyncGenerator<string> {
  // Simulate tokenization by splitting on word boundaries
  const words = prompt.split(/\s+/).filter(Boolean);

  // Echo back the prompt words with some "AI" additions
  for (let i = 0; i < Math.min(words.length * 2, maxTokens); i++) {
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100)
    );

    if (i < words.length) {
      yield words[i] + ' ';
    } else {
      // Add some "generated" content
      const additions = ['and', 'the', 'with', 'for', 'to', 'a', 'is', '...'];
      yield additions[i % additions.length] + ' ';
    }
  }
}

// Create the router with streaming handlers
export const router = createRouter(streamingContract, {
  generateText: async ({ body, stream }) => {
    const startTime = Date.now();
    let tokenIndex = 0;

    try {
      for await (const token of generateTokens(body.prompt, body.maxTokens)) {
        // Check if client disconnected
        if (!stream.isOpen) {
          console.log('Client disconnected, stopping generation');
          return;
        }

        // Send each token as a chunk
        stream.send({
          text: token,
          tokenIndex: tokenIndex++,
        });
      }

      // Send final response with metadata
      stream.close({
        totalTokens: tokenIndex,
        completionTime: Date.now() - startTime,
        finishReason: 'completed',
      });
    } catch (error) {
      console.error('Generation error:', error);
      stream.close({
        totalTokens: tokenIndex,
        completionTime: Date.now() - startTime,
        finishReason: 'error',
      });
    }
  },

  completeCode: async ({ body, stream }) => {
    const startTime = Date.now();

    // Simulated code completion suggestions
    const suggestions = [
      { text: 'function ', confidence: 0.95 },
      { text: 'const ', confidence: 0.85 },
      { text: 'return ', confidence: 0.75 },
      { text: '// TODO: ', confidence: 0.6 },
    ];

    for (const suggestion of suggestions) {
      if (!stream.isOpen) return;

      await new Promise((resolve) => setTimeout(resolve, 100));
      stream.send(suggestion);
    }

    stream.close({
      totalSuggestions: suggestions.length,
      completionTime: Date.now() - startTime,
    });
  },
});

// Start the server
if (import.meta.main) {
  Bun.serve({
    port: 3000,
    fetch: router.fetch,
  });

  console.log('Streaming server running at http://localhost:3000');
  console.log('Try: POST /ai/generate with { "prompt": "Hello world" }');
}
