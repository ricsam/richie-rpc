import { createRouter } from '@richie-rpc/server';
import {
  createWebSocketRouter,
  type TypedServerWebSocket,
  type UpgradeData,
} from '@richie-rpc/server/websocket';
import { streamingContract } from './streaming-contract';
import { chatContract } from './websocket-contract';
import z from 'zod';

// ===========================================
// HTTP Streaming Router
// ===========================================

export const streamingRouter = createRouter(
  streamingContract,
  {
    aiChat: async ({ body, stream }) => {
      const startTime = Date.now();
      const words = body.prompt.split(/\s+/).filter(Boolean);

      // Simulate AI streaming by sending words with delays
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;
        const delay = 100 + Math.random() * 200; // 100-300ms delay

        await new Promise((resolve) => setTimeout(resolve, delay));

        if (!stream.isOpen) {
          return; // Client disconnected
        }

        // Add space before word (except first)
        stream.send({ text: i === 0 ? word : ` ${word}` });
      }

      // Calculate stats
      const completionTime = Date.now() - startTime;
      const totalTokens = words.length;

      // Close with final response
      stream.close({
        totalTokens,
        completionTime,
      });
    },

    logs: ({ query, emitter, signal }) => {
      const filter = query.level || 'all';

      const logSources = ['api', 'database', 'auth', 'scheduler', 'worker'];
      const logMessages = {
        info: [
          'Request processed successfully',
          'Cache hit for key',
          'Connection established',
          'Task completed',
          'User authenticated',
        ],
        warn: [
          'High memory usage detected',
          'Slow query detected',
          'Rate limit approaching',
          'Deprecated API called',
          'Connection pool exhausted',
        ],
        error: [
          'Failed to connect to database',
          'Authentication failed',
          'Request timeout',
          'Invalid payload',
          'Service unavailable',
        ],
      };

      // Generate random log entries
      const logInterval = setInterval(() => {
        if (!emitter.isOpen) return;

        // Pick random level
        const levels: Array<'info' | 'warn' | 'error'> = ['info', 'info', 'info', 'warn', 'error'];
        const level = levels[Math.floor(Math.random() * levels.length)] as
          | 'info'
          | 'warn'
          | 'error';

        // Filter by level
        if (filter !== 'all' && filter !== level) {
          return;
        }

        const messages = logMessages[level];
        const message = messages[Math.floor(Math.random() * messages.length)];
        const source = logSources[Math.floor(Math.random() * logSources.length)];

        emitter.send('log', {
          timestamp: new Date().toISOString(),
          level,
          message: message ?? 'Unknown message',
          source,
        });
      }, 1000 + Math.random() * 2000); // 1-3s interval

      // Heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        if (!emitter.isOpen) return;
        emitter.send('heartbeat', { timestamp: new Date().toISOString() });
      }, 30000);

      // Cleanup on abort
      signal.addEventListener('abort', () => {
        clearInterval(logInterval);
        clearInterval(heartbeatInterval);
      });

      // Return cleanup function
      return () => {
        clearInterval(logInterval);
        clearInterval(heartbeatInterval);
      };
    },
  },
  { basePath: '/streaming' }
);

// ===========================================
// WebSocket Chat Router
// ===========================================

// Track connected users: WebSocket -> username
const connectedUsers = new Map<Bun.ServerWebSocket<UpgradeData>, string>();

// Get all WebSockets for a given room (we use a single global room)
function broadcastToAll<K extends keyof (typeof chatContract)['chat']['serverMessages']>(
  type: K,
  payload: Parameters<
    TypedServerWebSocket<(typeof chatContract)['chat'], Bun.ServerWebSocket<UpgradeData>>['send']
  >[1],
  excludeWs?: Bun.ServerWebSocket<UpgradeData>
) {
  for (const ws of connectedUsers.keys()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }
}

export const wsRouter = createWebSocketRouter(
  chatContract,
  {
    chat: {
      open() {
        // User connected but not yet joined
        console.log('WebSocket connected');
      },

      message({ ws, message, data }) {
        console.log('data', data.test);
        switch (message.type) {
          case 'join': {
            const { username } = message.payload;

            // Check if username is taken
            for (const existingUsername of connectedUsers.values()) {
              if (existingUsername === username) {
                ws.send('error', { message: 'Username already taken' });
                return;
              }
            }

            // Register user
            connectedUsers.set(ws.raw, username);

            // Broadcast user joined
            broadcastToAll('userJoined', {
              username,
              userCount: connectedUsers.size,
            });

            console.log(`User "${username}" joined. Total users: ${connectedUsers.size}`);
            break;
          }

          case 'message': {
            const username = connectedUsers.get(ws.raw);
            if (!username) {
              ws.send('error', {
                message: 'Must join before sending messages',
              });
              return;
            }

            // Broadcast message to all (including sender)
            const messagePayload = {
              username,
              text: message.payload.text,
              timestamp: new Date().toISOString(),
            };

            // Send to all including self
            for (const clientWs of connectedUsers.keys()) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'message', payload: messagePayload }));
              }
            }
            break;
          }

          case 'typing': {
            const username = connectedUsers.get(ws.raw);
            if (!username) return;

            // Broadcast typing status to others (not self)
            broadcastToAll(
              'typing',
              {
                username,
                isTyping: message.payload.isTyping,
              },
              ws.raw
            );
            break;
          }
        }
      },

      close({ ws }) {
        const username = connectedUsers.get(ws.raw);
        if (username) {
          connectedUsers.delete(ws.raw);

          // Broadcast user left
          broadcastToAll('userLeft', {
            username,
            userCount: connectedUsers.size,
          });

          console.log(`User "${username}" left. Total users: ${connectedUsers.size}`);
        }
      },

      validationError({ ws, error }) {
        ws.send('error', { message: `Validation error: ${error.message}` });
      },
    },
  },
  {
    dataSchema: z.object({
      test: z.string(),
    }),
    rawWebSocket: {} as Bun.ServerWebSocket<UpgradeData>,
  }
);
