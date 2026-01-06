/**
 * Server-Sent Events (SSE) Client Example
 *
 * This example demonstrates how to consume SSE endpoints
 * with the event-based client API.
 */

import { createClient } from '@richie-rpc/client';
import { sseContract } from './contract';

const client = createClient(sseContract, {
  baseUrl: 'http://localhost:3000',
});

async function main() {
  console.log('=== SSE Client Example ===\n');

  // Example 1: Log streaming with filter
  console.log('1. Connecting to log stream (errors only)...\n');

  const logs = client.logs({ query: { level: 'error' } });

  logs.on('log', (log) => {
    const color =
      log.level === 'error' ? '\x1b[31m' : log.level === 'warn' ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${log.level.toUpperCase()}]\x1b[0m ${log.timestamp} - ${log.message}`);
    if (log.source) {
      console.log(`  Source: ${log.source}`);
    }
  });

  logs.on('heartbeat', (hb) => {
    console.log(`\x1b[90m[heartbeat] ${hb.timestamp} (connection: ${hb.connectionId})\x1b[0m`);
  });

  logs.on('error', (err) => {
    console.error('Log stream error:', err.message);
  });

  // Let it run for 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log('\nClosing log stream...');
  logs.close();

  // Example 2: Stock ticker
  console.log('\n2. Connecting to stock ticker (AAPL)...\n');

  const ticker = client.stockTicker({ params: { symbol: 'AAPL' } });

  ticker.on('price', (data) => {
    const arrow = data.change >= 0 ? '\x1b[32m▲\x1b[0m' : '\x1b[31m▼\x1b[0m';
    console.log(
      `${data.symbol}: $${data.price.toFixed(2)} ${arrow} ${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent.toFixed(2)}%)`,
    );
  });

  ticker.on('trade', (trade) => {
    const side = trade.side === 'buy' ? '\x1b[32mBUY\x1b[0m' : '\x1b[31mSELL\x1b[0m';
    console.log(`  Trade: ${side} ${trade.quantity} @ $${trade.price.toFixed(2)}`);
  });

  ticker.on('marketStatus', (status) => {
    console.log(
      `Market is ${status.isOpen ? 'OPEN' : 'CLOSED'}. Next change: ${status.nextChange}`,
    );
  });

  // Let it run for 15 seconds
  await new Promise((resolve) => setTimeout(resolve, 15000));
  console.log('\nClosing ticker stream...');
  ticker.close();

  // Example 3: User notifications
  console.log('\n3. Connecting to notifications (user: demo-user)...\n');

  const notifications = client.notifications({
    params: { userId: 'demo-user' },
    query: { types: 'message,alert' }, // Only messages and alerts
  });

  notifications.on('notification', (notif) => {
    const icon =
      notif.type === 'message'
        ? '💬'
        : notif.type === 'alert'
          ? '🚨'
          : notif.type === 'reminder'
            ? '⏰'
            : 'ℹ️';
    console.log(`${icon} [${notif.type}] ${notif.title}`);
    console.log(`   ${notif.body}`);
    console.log(`   Created: ${notif.createdAt}`);
  });

  notifications.on('badge', (badge) => {
    console.log(`📬 Unread notifications: ${badge.unreadCount}`);
  });

  // Check connection state
  console.log('Connection state:', notifications.state);

  // Let it run for 30 seconds
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log('\nClosing notifications stream...');
  notifications.close();

  console.log('\n=== Done ===');
}

main().catch(console.error);
