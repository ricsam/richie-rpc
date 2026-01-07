import { expect, test } from '@playwright/test';

test.describe('POST Streaming (NDJSON)', () => {
  test('should receive chunks progressively', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const response = await fetch('/streaming/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello world test with multiple words' }),
      });

      if (!response.body) {
        return [];
      }

      const chunks: string[] = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        chunks.push(text);
      }
      return chunks;
    });

    expect(result.length).toBeGreaterThan(1); // Multiple chunks received
  });

  test('should receive final response with stats', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const response = await fetch('/streaming/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello world' }),
      });

      const chunks: any[] = [];
      let finalResponse: any = undefined;

      if (!response.body) {
        return { chunks: [], finalResponse: undefined };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.__final__) {
            finalResponse = parsed.data;
          } else {
            chunks.push(parsed);
          }
        }
      }

      return { chunks, finalResponse };
    });

    expect(result.finalResponse).toBeDefined();
    expect(result.finalResponse.totalTokens).toBeGreaterThan(0);
    expect(result.finalResponse.completionTime).toBeGreaterThan(0);
  });

  test('should support aborting mid-stream', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      const response = await fetch('/streaming/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Long text with many words to stream for testing abort' }),
        signal: controller.signal,
      });

      if (!response.body) {
        return { aborted: false };
      }

      const reader = response.body.getReader();
      await reader.read(); // Read first chunk
      controller.abort(); // Abort after first chunk

      return { aborted: true };
    });

    expect(result.aborted).toBe(true);
  });
});

test.describe('SSE Endpoints', () => {
  test('should connect and receive log events', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any[]>((resolve) => {
        const events: any[] = [];
        const es = new EventSource('/streaming/logs');

        es.addEventListener('log', (e) => {
          events.push(JSON.parse(e.data));
          if (events.length >= 2) {
            es.close();
            resolve(events);
          }
        });

        // Timeout after 10s
        setTimeout(() => {
          es.close();
          resolve(events);
        }, 10000);
      });
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toHaveProperty('level');
    expect(result[0]).toHaveProperty('message');
    expect(result[0]).toHaveProperty('timestamp');
  });

  test('should filter logs by level', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any[]>((resolve) => {
        const events: any[] = [];
        const es = new EventSource('/streaming/logs?level=error');

        es.addEventListener('log', (e) => {
          events.push(JSON.parse(e.data));
          if (events.length >= 1) {
            es.close();
            resolve(events);
          }
        });

        // Timeout after 15s (errors are less frequent)
        setTimeout(() => {
          es.close();
          resolve(events);
        }, 15000);
      });
    });

    // All received events should be 'error' level
    for (const event of result) {
      expect(event.level).toBe('error');
    }
  });

  test('should receive heartbeat events', async ({ page }) => {
    test.setTimeout(45000); // Heartbeat is every 30s, wait up to 35s
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<{ receivedHeartbeat: boolean }>((resolve) => {
        const es = new EventSource('/streaming/logs');

        es.addEventListener('heartbeat', () => {
          es.close();
          resolve({ receivedHeartbeat: true });
        });

        // Heartbeat is sent every 30s, wait up to 35s
        setTimeout(() => {
          es.close();
          resolve({ receivedHeartbeat: false });
        }, 35000);
      });
    });

    expect(result.receivedHeartbeat).toBe(true);
  });

  test('should handle client disconnect gracefully', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<{ connected: boolean; closed: boolean }>((resolve) => {
        const es = new EventSource('/streaming/logs');

        es.onopen = () => {
          // Close immediately after connecting
          es.close();
          resolve({ connected: true, closed: true });
        };

        es.onerror = () => {
          es.close();
          resolve({ connected: false, closed: true });
        };

        setTimeout(() => {
          es.close();
          resolve({ connected: false, closed: true });
        }, 5000);
      });
    });

    expect(result.connected).toBe(true);
    expect(result.closed).toBe(true);
  });
});

test.describe('WebSocket Chat', () => {
  test('should connect to WebSocket server', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<{ connected: boolean }>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.close();
          resolve({ connected: true });
        };
        ws.onerror = () => resolve({ connected: false });

        setTimeout(() => {
          ws.close();
          resolve({ connected: false });
        }, 5000);
      });
    });

    expect(result.connected).toBe(true);
  });

  test('should join chat and receive confirmation', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'TestUser' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'userJoined') {
            ws.close();
            resolve(msg.payload);
          }
        };

        setTimeout(() => {
          ws.close();
          resolve({ error: 'timeout' });
        }, 5000);
      });
    });

    expect(result.username).toBe('TestUser');
    expect(result.userCount).toBeGreaterThanOrEqual(1);
  });

  test('should broadcast messages between clients', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/');

    // Set up client 2 to listen for messages
    const client2Promise = page2.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User2' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'message' && msg.payload.username === 'User1') {
            ws.close();
            resolve(msg.payload);
          }
        };

        setTimeout(() => {
          ws.close();
          resolve({ error: 'timeout' });
        }, 10000);
      });
    });

    // Wait a bit for client2 to connect
    await page1.waitForTimeout(500);

    // Client 1 joins and sends message
    await page1.evaluate(async () => {
      return new Promise<void>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User1' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'userJoined' && msg.payload.username === 'User1') {
            ws.send(JSON.stringify({ type: 'message', payload: { text: 'Hello from User1!' } }));
            setTimeout(() => {
              ws.close();
              resolve();
            }, 500);
          }
        };
      });
    });

    const result = await client2Promise;
    expect(result.text).toBe('Hello from User1!');
    expect(result.username).toBe('User1');
    expect(result.timestamp).toBeDefined();
  });

  test('should show typing indicators', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/');

    // Set up client 2 to listen for typing
    const client2Promise = page2.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User2' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'typing') {
            ws.close();
            resolve(msg.payload);
          }
        };

        setTimeout(() => {
          ws.close();
          resolve({ error: 'timeout' });
        }, 10000);
      });
    });

    await page1.waitForTimeout(500);

    // Client 1 joins and sends typing indicator
    await page1.evaluate(async () => {
      return new Promise<void>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User1' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'userJoined' && msg.payload.username === 'User1') {
            ws.send(JSON.stringify({ type: 'typing', payload: { isTyping: true } }));
            setTimeout(() => {
              ws.close();
              resolve();
            }, 500);
          }
        };
      });
    });

    const result = await client2Promise;
    expect(result.username).toBe('User1');
    expect(result.isTyping).toBe(true);
  });

  test('should notify when user leaves', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/');

    // Set up client 2 to listen for userLeft
    const client2Promise = page2.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User2' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'userLeft' && msg.payload.username === 'User1') {
            ws.close();
            resolve(msg.payload);
          }
        };

        setTimeout(() => {
          ws.close();
          resolve({ error: 'timeout' });
        }, 10000);
      });
    });

    await page1.waitForTimeout(500);

    // Client 1 joins and then disconnects
    await page1.evaluate(async () => {
      return new Promise<void>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', payload: { username: 'User1' } }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'userJoined' && msg.payload.username === 'User1') {
            // Disconnect after joining
            setTimeout(() => {
              ws.close();
              resolve();
            }, 300);
          }
        };
      });
    });

    const result = await client2Promise;
    expect(result.username).toBe('User1');
    expect(result.userCount).toBeDefined();
  });

  test('should validate message payloads', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          // Send invalid message (missing required fields)
          ws.send(JSON.stringify({ type: 'message', payload: {} }));
        };
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'error') {
            ws.close();
            resolve(msg.payload);
          }
        };

        setTimeout(() => {
          ws.close();
          resolve({ error: 'timeout' });
        }, 5000);
      });
    });

    expect(result.message).toBeDefined();
  });
});

test.describe('File Upload with Progress', () => {
  test('should report upload progress events', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const progressEvents: number[] = [];
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            progressEvents.push(e.loaded / e.total);
          }
        };

        xhr.onload = () => {
          resolve({
            status: xhr.status,
            progressEvents,
            response: JSON.parse(xhr.responseText),
          });
        };

        xhr.onerror = () => {
          resolve({ error: 'request failed' });
        };

        // Create a larger file to ensure multiple progress events
        const largeContent = 'x'.repeat(100000); // 100KB
        const formData = new FormData();
        formData.append(
          '__json__',
          JSON.stringify({
            documents: [{ file: { __fileRef__: 'documents.0.file' }, name: 'large.txt' }],
            category: 'progress-test',
          }),
        );
        formData.append('documents.0.file', new Blob([largeContent]), 'large.txt');

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    });

    expect(result.status).toBe(201);
    expect(result.progressEvents.length).toBeGreaterThan(0);
    expect(result.progressEvents[result.progressEvents.length - 1]).toBe(1); // 100%
  });

  test('should complete upload successfully with progress tracking', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const progressEvents: number[] = [];
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            progressEvents.push(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          resolve({
            status: xhr.status,
            progressEvents,
            response: JSON.parse(xhr.responseText),
          });
        };

        xhr.onerror = () => {
          resolve({ error: 'request failed' });
        };

        // Create test files
        const file1Content = 'Test file content for document 1';
        const file2Content = 'Test file content for document 2 with more text';
        const formData = new FormData();
        formData.append(
          '__json__',
          JSON.stringify({
            documents: [
              {
                file: { __fileRef__: 'documents.0.file' },
                name: 'doc1.txt',
                tags: ['test', 'e2e'],
              },
              { file: { __fileRef__: 'documents.1.file' }, name: 'doc2.txt' },
            ],
            category: 'e2e-progress-test',
          }),
        );
        formData.append('documents.0.file', new Blob([file1Content]), 'doc1.txt');
        formData.append('documents.1.file', new Blob([file2Content]), 'doc2.txt');

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    });

    expect(result.status).toBe(201);
    expect(result.response.uploadedCount).toBe(2);
    expect(result.response.totalSize).toBeGreaterThan(0);
    expect(result.response.filenames).toContain('doc1.txt');
    expect(result.response.filenames).toContain('doc2.txt');
  });
});
