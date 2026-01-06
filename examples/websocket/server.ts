/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * WebSocket Server Example
 *
 * This example demonstrates how to implement a WebSocket chat server
 * with typed messages, rooms, and pub/sub.
 */

import { createWebSocketRouter } from '@richie-rpc/server/websocket';
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

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { users: new Map(), messages: [] });
  }
  return rooms.get(roomId)!;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Define the per-connection state type
interface ChatConnectionState {
  connectionId: string;
}

// Create the WebSocket router with typed state
export const wsRouter = createWebSocketRouter(
  chatContract,
  {
    chat: {
      open(ws) {
        const roomId = ws.data.params.roomId;
        const connectionId = generateId();

        // Store connection ID in typed state
        ws.data.state.connectionId = connectionId;

        console.log(`[WS] Connection opened for room ${roomId}`);

        // Subscribe to the room topic for broadcasts
        ws.subscribe(`room:${roomId}`);
      },

      message(ws, msg) {
        const roomId = ws.data.params.roomId;
        const connectionId = ws.data.state.connectionId;
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

            // Notify others that user joined
            ws.publish(`room:${roomId}`, 'userJoined', {
              userId: user.id,
              username: user.username,
              avatar: user.avatar,
              userCount: room.users.size,
            });
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

            // Broadcast to all users in room (including sender)
            ws.publish(`room:${roomId}`, 'message', message);
            // Also send to self (publish doesn't send to the sender)
            ws.send('message', message);
            break;
          }

          case 'typing': {
            const user = room.users.get(connectionId);
            if (!user) return;

            // Broadcast typing indicator to others
            ws.publish(`room:${roomId}`, 'typing', {
              userId: user.id,
              username: user.username,
              isTyping: msg.payload.isTyping,
            });
            break;
          }

          case 'leave': {
            const user = room.users.get(connectionId);
            if (user) {
              room.users.delete(connectionId);
              console.log(`[WS] ${user.username} left room ${roomId}`);

              ws.publish(`room:${roomId}`, 'userLeft', {
                userId: user.id,
                username: user.username,
                userCount: room.users.size,
              });
            }
            ws.close();
            break;
          }
        }
      },

      close(ws) {
        const roomId = ws.data.params.roomId;
        const connectionId = ws.data.state.connectionId;
        const room = rooms.get(roomId);

        if (room) {
          const user = room.users.get(connectionId);
          if (user) {
            room.users.delete(connectionId);
            console.log(`[WS] ${user.username} disconnected from room ${roomId}`);

            // Notify others
            ws.publish(`room:${roomId}`, 'userLeft', {
              userId: user.id,
              username: user.username,
              userCount: room.users.size,
            });
          }

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId);
            console.log(`[WS] Room ${roomId} is now empty and removed`);
          }
        }
      },

      validationError(ws, error) {
        console.error('[WS] Validation error:', error.message);
        ws.send('error', {
          code: 'INVALID_MESSAGE',
          message: error.message,
        });
      },
    },
  },
  { state: {} as ChatConnectionState },
);

// Start the server
if (import.meta.main) {
  Bun.serve({
    port: 3000,

    websocket: wsRouter.websocketHandler,

    async fetch(request, server) {
      // Try WebSocket upgrade
      const wsMatch = await wsRouter.matchAndPrepareUpgrade(request);
      if (wsMatch && request.headers.get('upgrade') === 'websocket') {
        if (server.upgrade(request, { data: wsMatch })) {
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
