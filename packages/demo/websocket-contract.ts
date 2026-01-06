import { defineWebSocketContract } from '@richie-rpc/core';
import { z } from 'zod';

export const chatContract = defineWebSocketContract({
  chat: {
    path: '/ws/chat',
    clientMessages: {
      join: { payload: z.object({ username: z.string().min(1) }) },
      message: { payload: z.object({ text: z.string().min(1) }) },
      typing: { payload: z.object({ isTyping: z.boolean() }) },
    },
    serverMessages: {
      userJoined: { payload: z.object({ username: z.string(), userCount: z.number() }) },
      userLeft: { payload: z.object({ username: z.string(), userCount: z.number() }) },
      message: {
        payload: z.object({ username: z.string(), text: z.string(), timestamp: z.string() }),
      },
      typing: { payload: z.object({ username: z.string(), isTyping: z.boolean() }) },
      error: { payload: z.object({ message: z.string() }) },
    },
  },
});
