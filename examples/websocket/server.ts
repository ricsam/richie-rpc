/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * WebSocket Server Example
 *
 * This example demonstrates how to implement a WebSocket chat server
 * with typed messages, rooms, and pub/sub.
 */

import { createWebSocketRouter, type UpgradeData } from '@richie-rpc/server';
import { chatContract } from './contract';

// Store connected users per room
interface User {
  id: string;
  username: string;
  avatar?: string;
}

interface Room {
  users: Map<string, User>; // keyed by connection ID
  messages: Array<{
    id: string;
    userId: string;
    username: string;
    text: string;
    timestamp: string;
  }>;
}

const rooms = new Map<string, Room>();

// Define the WebSocket type for this server
type BunWS = Bun.ServerWebSocket<UpgradeData>;

// Track connection IDs per WebSocket
const connectionIds = new WeakMap<BunWS, string>();

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { users: new Map(), messages: [] });
  }
  return rooms.get(roomId)!;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Create the WebSocket router with rawWebSocket for type inference
export const wsRouter = createWebSocketRouter(
  chatContract,
  {
    chat: {
      open({ ws, params }) {
        const roomId = params.roomId;
        const connectionId = generateId();

        // Store connection ID in WeakMap
        connectionIds.set(ws.raw, connectionId);

        console.log(`[WS] Connection opened for room ${roomId}`);

        // Subscribe to the room topic for broadcasts (Bun-specific)
        ws.raw.subscribe(`room:${roomId}`);
      },

      message({ ws, message: msg, params }) {
        const roomId = params.roomId;
        const connectionId = connectionIds.get(ws.raw)!;
        const room = getOrCreateRoom(roomId);

        switch (msg.type) {
          case 'join': {
            // Check if username is taken
            const existingUser = Array.from(room.users.values()).find(
              (u) => u.username.toLowerCase() === msg.payload.username.toLowerCase(),
            );

            if (existingUser) {
              ws.send('error', {
                code: 'USERNAME_TAKEN',
                message: `Username "${msg.payload.username}" is already taken in this room`,
              });
              return;
            }

            // Add user to room
            const user: User = {
              id: connectionId,
              username: msg.payload.username,
              avatar: msg.payload.avatar,
            };
            room.users.set(connectionId, user);

            console.log(`[WS] ${user.username} joined room ${roomId}`);

            // Send room state to the joining user
            ws.send('roomState', {
              roomId,
              users: Array.from(room.users.values()).map((u) => ({
                userId: u.id,
                username: u.username,
                avatar: u.avatar,
              })),
              recentMessages: room.messages.slice(-50), // Last 50 messages
            });

            // Notify others that user joined (Bun-specific pub/sub)
            ws.raw.publish(
              `room:${roomId}`,
              JSON.stringify({
                type: 'userJoined',
                payload: {
                  userId: user.id,
                  username: user.username,
                  avatar: user.avatar,
                  userCount: room.users.size,
                },
              }),
            );
            break;
          }

          case 'message': {
            const user = room.users.get(connectionId);
            if (!user) {
              ws.send('error', {
                code: 'NOT_JOINED',
                message: 'You must join the room before sending messages',
              });
              return;
            }

            // Create message
            const message = {
              id: generateId(),
              userId: user.id,
              username: user.username,
              text: msg.payload.text,
              replyTo: msg.payload.replyTo,
              timestamp: new Date().toISOString(),
            };

            // Store message (keep last 100)
            room.messages.push(message);
            if (room.messages.length > 100) {
              room.messages.shift();
            }

            console.log(`[WS] ${user.username}: ${msg.payload.text}`);

            // Broadcast to all users in room (Bun-specific pub/sub)
            ws.raw.publish(`room:${roomId}`, JSON.stringify({ type: 'message', payload: message }));
            // Also send to self (publish doesn't send to the sender)
            ws.send('message', message);
            break;
          }

          case 'typing': {
            const user = room.users.get(connectionId);
            if (!user) return;

            // Broadcast typing indicator to others (Bun-specific pub/sub)
            ws.raw.publish(
              `room:${roomId}`,
              JSON.stringify({
                type: 'typing',
                payload: {
                  userId: user.id,
                  username: user.username,
                  isTyping: msg.payload.isTyping,
                },
              }),
            );
            break;
          }

          case 'leave': {
            const user = room.users.get(connectionId);
            if (user) {
              room.users.delete(connectionId);
              console.log(`[WS] ${user.username} left room ${roomId}`);

              ws.raw.publish(
                `room:${roomId}`,
                JSON.stringify({
                  type: 'userLeft',
                  payload: {
                    userId: user.id,
                    username: user.username,
                    userCount: room.users.size,
                  },
                }),
              );
            }
            ws.close();
            break;
          }
        }
      },

      close({ ws, params }) {
        const roomId = params.roomId;
        const connectionId = connectionIds.get(ws.raw)!;
        const room = rooms.get(roomId);

        if (room) {
          const user = room.users.get(connectionId);
          if (user) {
            room.users.delete(connectionId);
            console.log(`[WS] ${user.username} disconnected from room ${roomId}`);

            // Notify others (Bun-specific pub/sub)
            ws.raw.publish(
              `room:${roomId}`,
              JSON.stringify({
                type: 'userLeft',
                payload: {
                  userId: user.id,
                  username: user.username,
                  userCount: room.users.size,
                },
              }),
            );
          }

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId);
            console.log(`[WS] Room ${roomId} is now empty and removed`);
          }
        }
      },

      validationError({ ws, error }) {
        console.error('[WS] Validation error:', error.message);
        ws.send('error', {
          code: 'INVALID_MESSAGE',
          message: error.message,
        });
      },
    },
  },
  {
    // Pass rawWebSocket for type inference - handlers get typed ws.raw
    rawWebSocket: {} as BunWS,
  },
);

// Start the server
if (import.meta.main) {
  Bun.serve<UpgradeData>({
    port: 3000,

    websocket: {
      open(ws) {
        wsRouter.websocketHandler.open({
          ws,
          upgradeData: ws.data,
        });
      },
      message(ws, rawMessage) {
        wsRouter.websocketHandler.message({
          ws,
          rawMessage,
          upgradeData: ws.data,
        });
      },
      close(ws, code, reason) {
        wsRouter.websocketHandler.close({
          ws,
          code,
          reason,
          upgradeData: ws.data,
        });
      },
      drain(ws) {
        wsRouter.websocketHandler.drain({
          ws,
          upgradeData: ws.data,
        });
      },
    },

    async fetch(request, server) {
      // Try WebSocket upgrade
      const upgradeData = await wsRouter.matchAndPrepareUpgrade(request);
      if (upgradeData && request.headers.get('upgrade') === 'websocket') {
        if (server.upgrade(request, { data: upgradeData })) {
          return; // Upgrade successful
        }
        return new Response('WebSocket upgrade failed', { status: 500 });
      }

      // Simple HTTP endpoint for health check
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return Response.json({
          status: 'ok',
          rooms: Array.from(rooms.entries()).map(([id, room]) => ({
            id,
            userCount: room.users.size,
          })),
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log('WebSocket server running at ws://localhost:3000');
  console.log('Connect to: ws://localhost:3000/ws/chat/{roomId}');
  console.log('Health check: http://localhost:3000/health');
}
