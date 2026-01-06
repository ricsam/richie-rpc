/**
 * Streaming Client Example
 *
 * This example demonstrates how to consume streaming endpoints
 * with the event-based client API.
 */

import { createClient } from '@richie-rpc/client';
import { streamingContract } from './contract';

const client = createClient(streamingContract, {
  baseUrl: 'http://localhost:3000',
});

async function main() {
  console.log('=== Streaming Client Example ===\n');

  // Example 1: Basic text generation
  console.log('1. Generating text...\n');

  const result = client.generateText({
    body: {
      prompt: 'The quick brown fox jumps over the lazy dog',
      maxTokens: 50,
      temperature: 0.7,
    },
  });

  // Collect all text for display
  let fullText = '';

  // Listen for chunks
  result.on('chunk', (chunk) => {
    fullText += chunk.text;
    process.stdout.write(chunk.text);
  });

  // Wait for completion
  await new Promise<void>((resolve, reject) => {
    result.on('close', (final) => {
      console.log('\n');
      if (final) {
        console.log('--- Generation Complete ---');
        console.log(`Total tokens: ${final.totalTokens}`);
        console.log(`Time: ${final.completionTime}ms`);
        console.log(`Finish reason: ${final.finishReason}`);
      }
      resolve();
    });

    result.on('error', (error) => {
      console.error('Stream error:', error.message);
      reject(error);
    });
  });

  // Example 2: Code completion
  console.log('\n2. Code completion...\n');

  const codeResult = client.completeCode({
    body: {
      code: 'const greet = ',
      language: 'typescript',
      cursorPosition: 14,
    },
  });

  codeResult.on('chunk', (chunk) => {
    console.log(`  "${chunk.text}" (confidence: ${(chunk.confidence * 100).toFixed(0)}%)`);
  });

  await new Promise<void>((resolve) => {
    codeResult.on('close', (final) => {
      if (final) {
        console.log(`\nTotal suggestions: ${final.totalSuggestions}`);
        console.log(`Time: ${final.completionTime}ms`);
      }
      resolve();
    });
  });

  // Example 3: Aborting a stream
  console.log('\n3. Aborting a stream...\n');

  const abortableResult = client.generateText({
    body: { prompt: 'This will be interrupted', maxTokens: 100 },
  });

  let chunkCount = 0;
  abortableResult.on('chunk', (chunk) => {
    chunkCount++;
    process.stdout.write(chunk.text);

    // Abort after 5 chunks
    if (chunkCount >= 5) {
      console.log('\n[Aborting stream...]');
      abortableResult.abort();
    }
  });

  await new Promise<void>((resolve) => {
    abortableResult.on('close', () => {
      console.log(`Stream ended after ${chunkCount} chunks`);
      console.log(`Aborted: ${abortableResult.aborted}`);
      resolve();
    });

    abortableResult.on('error', () => {
      // AbortError is expected when we abort
      resolve();
    });
  });

  console.log('\n=== Done ===');
}

main().catch(console.error);
