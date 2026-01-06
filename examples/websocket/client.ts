/**
 * WebSocket Client Example
 *
 * This example demonstrates how to use the typed WebSocket client
 * for bidirectional real-time communication.
 */

import { createWebSocketClient } from '@richie-rpc/client';
import { chatContract } from './contract';

const wsClient = createWebSocketClient(chatContract, {
  baseUrl: 'ws://localhost:3000',
});

async function main() {
  console.log('=== WebSocket Client Example ===\n');

  const roomId = 'general';
  const username = `User_${Math.random().toString(36).substring(2, 6)}`;

  console.log(`Connecting to room: ${roomId} as ${username}\n`);

  // Create a typed WebSocket instance for the chat endpoint
  const chat = wsClient.chat({
    params: { roomId },
    query: { token: 'optional-auth-token' },
  });

  // Track connection state
  let isConnected = false;
  let hasJoined = false;

  // Set up event handlers before connecting
  chat.onStateChange((connected) => {
    isConnected = connected;
    console.log(`Connection state: ${connected ? 'Connected' : 'Disconnected'}`);

    if (connected && !hasJoined) {
      // Join the room once connected
      console.log(`Joining as ${username}...`);
      chat.send('join', { username });
    }
  });

  // Handle connection errors
  chat.onError((error) => {
    console.error('Connection error:', error.message);
  });

  // Listen for room state (sent after joining)
  chat.on('roomState', (state) => {
    hasJoined = true;
    console.log(`\nJoined room: ${state.roomId}`);
    console.log(`Users online: ${state.users.length}`);
    state.users.forEach((u) => {
      console.log(`  - ${u.username}${u.userId === username ? ' (you)' : ''}`);
    });

    if (state.recentMessages.length > 0) {
      console.log('\nRecent messages:');
      state.recentMessages.slice(-5).forEach((msg) => {
        console.log(`  ${msg.username}: ${msg.text}`);
      });
    }
    console.log('');
  });

  // Listen for new messages
  chat.on('message', (msg) => {
    const isOwn = msg.username === username;
    const prefix = isOwn ? '\x1b[32m' : '\x1b[36m'; // Green for own, cyan for others
    console.log(`${prefix}${msg.username}\x1b[0m: ${msg.text}`);
  });

  // Listen for user join/leave
  chat.on('userJoined', (data) => {
    console.log(`\x1b[33m→ ${data.username} joined (${data.userCount} online)\x1b[0m`);
  });

  chat.on('userLeft', (data) => {
    console.log(`\x1b[33m← ${data.username} left (${data.userCount} online)\x1b[0m`);
  });

  // Listen for typing indicators
  chat.on('typing', (data) => {
    if (data.isTyping) {
      console.log(`\x1b[90m${data.username} is typing...\x1b[0m`);
    }
  });

  // Listen for errors
  chat.on('error', (err) => {
    console.error(`\x1b[31mError [${err.code}]: ${err.message}\x1b[0m`);
  });

  // Listen for all messages (for debugging)
  // chat.onMessage((msg) => {
  //   console.log('Raw message:', msg);
  // });

  // Connect to the WebSocket server
  const disconnect = chat.connect();

  // Simulate activity
  console.log('Waiting for connection...\n');

  // Wait for connection and join
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (hasJoined) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  // Send some messages
  console.log('\nSending messages...\n');

  const messages = [
    'Hello everyone!',
    'How is everyone doing today?',
    'This is a test message.',
  ];

  for (const text of messages) {
    // Simulate typing
    chat.send('typing', { isTyping: true });
    await new Promise((r) => setTimeout(r, 500));
    chat.send('typing', { isTyping: false });

    // Send message
    chat.send('message', { text });
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Wait a bit to see any responses
  console.log('\nWaiting for activity...\n');
  await new Promise((r) => setTimeout(r, 5000));

  // Leave gracefully
  console.log('\nLeaving room...');
  chat.send('leave', {});

  // Disconnect
  await new Promise((r) => setTimeout(r, 500));
  disconnect();

  console.log('\n=== Done ===');
}

main().catch(console.error);
