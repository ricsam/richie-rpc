/**
 * Server-Sent Events (SSE) Server Example
 *
 * This example demonstrates how to implement SSE handlers
 * that push events to connected clients.
 */

import { createRouter } from '@richie-rpc/server';
import { sseContract } from './contract';

// Simulated log sources
const logSources = ['api', 'database', 'cache', 'auth', 'worker'];
const logMessages = {
  info: [
    'Request processed successfully',
    'Cache hit for key',
    'User authenticated',
    'Background job completed',
  ],
  warn: [
    'Slow query detected',
    'Rate limit approaching',
    'Deprecated API used',
    'Memory usage high',
  ],
  error: [
    'Connection timeout',
    'Invalid request format',
    'Authentication failed',
    'Database error',
  ],
};

// Generate a random log entry
function generateLog(level?: 'info' | 'warn' | 'error') {
  const levels: Array<'info' | 'warn' | 'error'> = ['info', 'warn', 'error'];
  const actualLevel = level || levels[Math.floor(Math.random() * levels.length)];
  const messages = logMessages[actualLevel];

  return {
    timestamp: new Date().toISOString(),
    level: actualLevel,
    message: messages[Math.floor(Math.random() * messages.length)],
    source: logSources[Math.floor(Math.random() * logSources.length)],
  };
}

// Simulated stock data
const stocks: Record<string, { price: number; volume: number }> = {
  AAPL: { price: 178.5, volume: 1000000 },
  GOOGL: { price: 141.2, volume: 500000 },
  MSFT: { price: 378.9, volume: 750000 },
  AMZN: { price: 178.3, volume: 600000 },
};

// Create the router with SSE handlers
export const router = createRouter(sseContract, {
  logs: ({ query, emitter, signal }) => {
    const filter = query.level || 'all';
    const sourceFilter = query.source;
    const connectionId = Math.random().toString(36).substring(7);

    console.log(`[SSE] Client connected to logs (filter: ${filter})`);

    // Send logs at random intervals
    const logInterval = setInterval(() => {
      if (!emitter.isOpen) return;

      const log = generateLog();

      // Apply filters
      if (filter !== 'all' && filter !== log.level) return;
      if (sourceFilter && log.source !== sourceFilter) return;

      emitter.send('log', log);
    }, 1000 + Math.random() * 2000);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!emitter.isOpen) return;
      emitter.send('heartbeat', {
        timestamp: new Date().toISOString(),
        connectionId,
      });
    }, 30000);

    // Cleanup when client disconnects
    signal.addEventListener('abort', () => {
      console.log(`[SSE] Client disconnected from logs`);
      clearInterval(logInterval);
      clearInterval(heartbeatInterval);
    });

    // Return cleanup function (alternative to signal listener)
    return () => {
      clearInterval(logInterval);
      clearInterval(heartbeatInterval);
    };
  },

  stockTicker: ({ params, emitter, signal }) => {
    const { symbol } = params;
    const stock = stocks[symbol] || { price: 100, volume: 100000 };

    console.log(`[SSE] Client subscribed to ${symbol} ticker`);

    // Simulate price updates
    const priceInterval = setInterval(() => {
      if (!emitter.isOpen) return;

      // Random price movement
      const change = (Math.random() - 0.5) * 2;
      stock.price += change;
      stock.volume += Math.floor(Math.random() * 10000);

      emitter.send('price', {
        symbol,
        price: Math.round(stock.price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round((change / stock.price) * 10000) / 100,
        volume: stock.volume,
        timestamp: new Date().toISOString(),
      });
    }, 2000);

    // Simulate occasional trades
    const tradeInterval = setInterval(() => {
      if (!emitter.isOpen) return;

      emitter.send('trade', {
        symbol,
        price: stock.price,
        quantity: Math.floor(Math.random() * 1000) + 1,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: new Date().toISOString(),
      });
    }, 5000);

    // Send market status on connect
    emitter.send('marketStatus', {
      isOpen: true,
      nextChange: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });

    signal.addEventListener('abort', () => {
      console.log(`[SSE] Client unsubscribed from ${symbol}`);
      clearInterval(priceInterval);
      clearInterval(tradeInterval);
    });
  },

  notifications: ({ params, query, emitter, signal }) => {
    const { userId } = params;
    const typeFilter = query.types?.split(',') || [];

    console.log(`[SSE] User ${userId} connected to notifications`);

    // Simulate notifications
    let unreadCount = 3;
    const notificationTypes = ['message', 'alert', 'reminder', 'system'] as const;

    const notificationInterval = setInterval(() => {
      if (!emitter.isOpen) return;

      const type =
        notificationTypes[Math.floor(Math.random() * notificationTypes.length)];

      // Apply type filter
      if (typeFilter.length > 0 && !typeFilter.includes(type)) return;

      unreadCount++;

      emitter.send('notification', {
        id: Math.random().toString(36).substring(7),
        type,
        title: `New ${type}`,
        body: `This is a ${type} notification for user ${userId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Update badge count
      emitter.send('badge', { unreadCount });
    }, 10000);

    // Send initial badge count
    emitter.send('badge', { unreadCount });

    signal.addEventListener('abort', () => {
      console.log(`[SSE] User ${userId} disconnected from notifications`);
      clearInterval(notificationInterval);
    });
  },
});

// Start the server
if (import.meta.main) {
  Bun.serve({
    port: 3000,
    fetch: router.fetch,
  });

  console.log('SSE server running at http://localhost:3000');
  console.log('Endpoints:');
  console.log('  GET /logs?level=all|info|warn|error');
  console.log('  GET /stocks/AAPL/ticker');
  console.log('  GET /users/123/notifications');
}
