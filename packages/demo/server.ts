import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { createRouter, RouteNotFoundError, Status, ValidationError } from '@richie-rpc/server';
import type { UpgradeData } from '@richie-rpc/server/websocket';
import { type User, usersContract } from './contract';
import reactDemoHtml from './index.html';
import { streamingRouter, wsRouter } from './streaming-server';

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Simple context with mock data
type AppContext = {
  appName: string;
  version: string;
  features: {
    darkMode: boolean;
    analytics: boolean;
  };
};

// Mock app configuration
const appConfig: AppContext = {
  appName: 'Richie RPC Demo',
  version: '1.0.0',
  features: {
    darkMode: true,
    analytics: false,
  },
};

// In-memory database
const users: Map<string, User> = new Map();
let nextId = 1;

// Seed some initial data
users.set('1', {
  id: '1',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 28,
});

users.set('2', {
  id: '2',
  name: 'Bob Smith',
  email: 'bob@example.com',
  age: 35,
});

// Create router with handlers and context
const router = createRouter<typeof usersContract, AppContext>(
  usersContract,
  {
    listUsers: async ({ query }) => {
      const limit = query?.limit ? parseInt(query.limit, 10) : 100;
      const offset = query?.offset ? parseInt(query.offset, 10) : 0;

      const allUsers = Array.from(users.values());
      const paginatedUsers = allUsers.slice(offset, offset + limit);

      return {
        status: Status.OK,
        body: {
          users: paginatedUsers,
          total: allUsers.length,
        },
      };
    },

    getUser: async ({ params, context }) => {
      // Example: Use context data (e.g., for logging or conditional logic)
      console.log(`Getting user ${params.id} from ${context.appName} v${context.version}`);

      const user = users.get(params.id);

      if (!user) {
        return {
          status: Status.NotFound,
          body: {
            error: 'Not Found',
            message: `User with id ${params.id} not found`,
          },
        };
      }

      return {
        status: Status.OK,
        body: user,
      };
    },

    createUser: async ({ body }) => {
      const id = String(nextId++);
      const user: User = {
        id,
        ...body,
      };

      users.set(id, user);

      return {
        status: Status.Created,
        body: user,
      };
    },

    updateUser: async ({ params, body }) => {
      const user = users.get(params.id);

      if (!user) {
        return {
          status: Status.NotFound,
          body: {
            error: 'Not Found',
            message: `User with id ${params.id} not found`,
          },
        };
      }

      const updatedUser: User = {
        ...user,
        ...body,
      };

      users.set(params.id, updatedUser);

      return {
        status: Status.OK,
        body: updatedUser,
      };
    },

    deleteUser: async ({ params }) => {
      const user = users.get(params.id);

      if (!user) {
        return {
          status: Status.NotFound,
          body: {
            error: 'Not Found',
            message: `User with id ${params.id} not found`,
          },
        };
      }

      users.delete(params.id);

      return {
        status: Status.NoContent,
        body: {} as Record<string, never>,
      };
    },

    // Custom status code example: I'm a teapot (RFC 2324)
    teapot: async ({ context }) => {
      // Example: Use context to customize response
      return {
        status: 418 as const,
        body: {
          message: "I'm a teapot! I cannot brew coffee.",
          isTeapot: true,
          appInfo: {
            name: context.appName,
            version: context.version,
            darkModeEnabled: context.features.darkMode,
          },
        },
      };
    },

    // File upload with nested files
    uploadDocuments: async ({ body }) => {
      const filenames: string[] = [];
      let totalSize = 0;

      for (const doc of body.documents) {
        // doc.file is a File object, doc.name and doc.tags are typed correctly
        filenames.push(doc.file.name);
        totalSize += doc.file.size;
        console.log(
          `Received file: ${doc.file.name} (${doc.file.size} bytes) as "${doc.name}" in category "${body.category}"`,
        );
        if (doc.tags) {
          console.log(`  Tags: ${doc.tags.join(', ')}`);
        }
      }

      return {
        status: Status.Created,
        body: {
          uploadedCount: body.documents.length,
          totalSize,
          filenames,
        },
      };
    },

    // File download
    downloadFile: async ({ params }) => {
      // Test case for binary file using Bun.file()
      if (params.fileId === 'test-image') {
        const bunFile = Bun.file('./tests/fixtures/test-image.png');
        const buffer = await bunFile.arrayBuffer();
        const file = new File([buffer], 'test-image.png', { type: bunFile.type });
        return {
          status: 200 as const,
          body: file,
        };
      }

      // Mock file storage - in real app, this would fetch from disk/S3/etc
      const mockFiles: Record<string, { content: string; name: string; type: string }> = {
        'doc-1': {
          content: 'Hello, World! This is a test document.',
          name: 'hello.txt',
          type: 'text/plain',
        },
        'doc-2': {
          content: '{"message": "JSON content"}',
          name: 'data.json',
          type: 'application/json',
        },
      };

      const fileInfo = mockFiles[params.fileId];

      if (!fileInfo) {
        return {
          status: Status.NotFound,
          body: {
            error: 'Not Found',
            message: `File with id ${params.fileId} not found`,
          },
        };
      }

      const file = new File([fileInfo.content], fileInfo.name, {
        type: fileInfo.type,
      });

      return {
        status: 200 as const,
        body: file,
      };
    },

    // Wildcard path parameter - serves static files from nested paths
    getStaticFile: async ({ params }) => {
      const filePath = params.filePath;
      const segments = filePath.split('/');

      // For demo purposes, just echo back the path info
      // In a real app, this would serve actual static files
      return {
        status: Status.OK,
        body: {
          requestedPath: filePath,
          segments,
        },
      };
    },
  },
  {
    basePath: '/api',
    context: async () => {
      // Return the mock app configuration as context
      return appConfig;
    },
  },
);

// Generate OpenAPI spec
const openAPISpec = generateOpenAPISpec(usersContract, {
  info: {
    title: 'Users API',
    version: '1.0.0',
    description: 'A simple user management API',
  },
  servers: [
    {
      url: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '3000'}/api`,
      description: 'Development server',
    },
  ],
});

// Create docs HTML
const docsHtml = createDocsResponse('/openapi.json', {
  title: 'Users API Documentation',
});

const redirectToLocal = (req: Request, from: RegExp, to: string) => {
  const newUrl = new URL(req.url);
  newUrl.hostname = '127.0.0.1';
  newUrl.port = process.env.PORT || '3000';
  newUrl.protocol = 'http';
  newUrl.pathname = newUrl.pathname.replace(from, to);
  const newRequest = new Request(newUrl, {
    headers: req.headers,
    method: req.method,
    body: req.body,
  });
  console.log(`[HTTP] Redirecting to: ${newUrl}`);
  return fetch(newRequest).then(async (response) => {
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      const body = await response.text();
      return new Response(body.replace(/(\/\.\.)+/gm, ''), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        },
      });
    }
    return response;
  });
};

// Start server
const server = Bun.serve({
  port: Number.parseInt(process.env.PORT || '3000', 10),
  routes: {
    '/index.html': reactDemoHtml,
    '/docs': docsHtml,
  },
  async fetch(request, server): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    const upgradeData = await wsRouter.matchAndPrepareUpgrade(request);
    if (upgradeData) {
      const success = server.upgrade(request, { data: upgradeData });
      if (success) {
        // Return empty response - Bun handles the upgrade
        return new Response(null, { status: 101 });
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Static routes
    if (url.pathname === '/openapi.json') {
      return Response.json(openAPISpec);
    }
    if (url.pathname === '/docs') {
      return docsHtml;
    }

    if (url.pathname.startsWith('/api')) {
      try {
        return await router.handle(request);
      } catch (error) {
        console.error('API error:', error);
        if (error instanceof ValidationError) {
          return Response.json(
            { error: 'Validation Error', field: error.field, issues: error.zodError.issues },
            { status: 400 },
          );
        }
        if (error instanceof RouteNotFoundError) {
          return Response.json({ error: 'Not Found' }, { status: 404 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/streaming')) {
      try {
        return await streamingRouter.handle(request);
      } catch (error) {
        console.error('Streaming error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/(chat|ai|logs|downloads)$/) || url.pathname === '/') {
      return redirectToLocal(request, /^\/(|chat|ai|logs|downloads)$/, '/index.html');
    }

    return new Response('Not Found', { status: 404 });
  },
  websocket: {
    data: {} as UpgradeData,
    open(ws) {
      wsRouter.websocketHandler.open({
        ws,
        upgradeData: ws.data,
        data: { test: 'test' },
      });
    },
    message(ws, rawMessage) {
      wsRouter.websocketHandler.message({
        ws: ws,
        rawMessage,
        upgradeData: ws.data,
        data: { test: 'test' },
      });
    },
    close(ws, code, reason) {
      wsRouter.websocketHandler.close({
        ws,
        code,
        reason,
        upgradeData: ws.data,
        data: { test: 'test' },
      });
    },
    drain(ws) {
      wsRouter.websocketHandler.drain({
        ws,
        upgradeData: ws.data,
        data: { test: 'test' },
      });
    },
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`⚛️  React Demo at http://localhost:${server.port}/`);
console.log(`📚 API Docs available at http://localhost:${server.port}/docs`);
console.log(`📄 OpenAPI Spec at http://localhost:${server.port}/openapi.json`);
