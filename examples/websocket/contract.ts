/**
 * WebSocket Contract Example
 *
 * This example demonstrates how to define WebSocket contracts for
 * bidirectional real-time communication.
 */

import { defineWebSocketContract } from '@richie-rpc/core';
import { z } from 'zod';

export const chatContract = defineWebSocketContract({
  /**
   * Chat room WebSocket endpoint.
   * Supports joining rooms, sending messages, and typing indicators.
   */
  chat: {
    path: '/ws/chat/:roomId',
    params: z.object({
      roomId: z.string().min(1),
    }),
    query: z.object({
      token: z.string().optional(), // Auth token
    }),

    // Messages the client can send to the server
    clientMessages: {
      // Join the room with a username
      join: {
        payload: z.object({
          username: z.string().min(1).max(50),
          avatar: z.string().url().optional(),
        }),
      },
      // Send a chat message
      message: {
        payload: z.object({
          text: z.string().min(1).max(1000),
          replyTo: z.string().optional(), // Reply to message ID
        }),
      },
      // Typing indicator
      typing: {
        payload: z.object({
          isTyping: z.boolean(),
        }),
      },
      // Leave the room
      leave: {
        payload: z.object({}),
      },
    },

    // Messages the server can send to the client
    serverMessages: {
      // User joined notification
      userJoined: {
        payload: z.object({
          userId: z.string(),
          username: z.string(),
          avatar: z.string().optional(),
          userCount: z.number(),
        }),
      },
      // User left notification
      userLeft: {
        payload: z.object({
          userId: z.string(),
          username: z.string(),
          userCount: z.number(),
        }),
      },
      // Chat message from a user
      message: {
        payload: z.object({
          id: z.string(),
          userId: z.string(),
          username: z.string(),
          text: z.string(),
          replyTo: z.string().optional(),
          timestamp: z.string(),
        }),
      },
      // Typing indicator from another user
      typing: {
        payload: z.object({
          userId: z.string(),
          username: z.string(),
          isTyping: z.boolean(),
        }),
      },
      // Room state on join
      roomState: {
        payload: z.object({
          roomId: z.string(),
          users: z.array(
            z.object({
              userId: z.string(),
              username: z.string(),
              avatar: z.string().optional(),
            }),
          ),
          recentMessages: z.array(
            z.object({
              id: z.string(),
              userId: z.string(),
              username: z.string(),
              text: z.string(),
              timestamp: z.string(),
            }),
          ),
        }),
      },
      // Error message
      error: {
        payload: z.object({
          code: z.enum([
            'USERNAME_TAKEN',
            'NOT_JOINED',
            'RATE_LIMITED',
            'INVALID_MESSAGE',
            'ROOM_FULL',
          ]),
          message: z.string(),
        }),
      },
    },
  },
});

export type ChatContract = typeof chatContract;
