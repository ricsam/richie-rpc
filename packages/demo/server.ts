import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { createRouter, RouteNotFoundError, Status, ValidationError } from '@richie-rpc/server';
import type { UpgradeData } from '@richie-rpc/server';
import { type User, usersContract } from './contract';
import authHooksHtml from './auth-hooks.html';
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

const DEMO_SESSION_HEADER = 'x-demo-session';

function buildUserList(limit = 100, offset = 0) {
  const allUsers = Array.from(users.values());
  const paginatedUsers = allUsers.slice(offset, offset + limit);

  return {
    users: paginatedUsers,
    total: allUsers.length,
  };
}

function createUnauthorizedResponse(scope: string) {
  return {
    status: Status.Unauthorized,
    body: {
      error: 'Unauthorized',
      message: `Expected Authorization header "Bearer ${scope}-<number>"`,
    },
  } as const;
}

function getNextDemoSessionToken(authorization: string | null, scope: string): string | null {
  if (!authorization) {
    return null;
  }

  const escapedScope = scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = authorization.match(new RegExp(`^Bearer ${escapedScope}-(\\d+)$`));
  if (!match?.[1]) {
    return null;
  }

  return `Bearer ${scope}-${Number.parseInt(match[1], 10) + 1}`;
}

function getDemoSessionHeaders(
  authorization: string | null,
  scope: string,
): Record<string, string> | null {
  const nextToken = getNextDemoSessionToken(authorization, scope);
  if (!nextToken) {
    return null;
  }

  return {
    [DEMO_SESSION_HEADER]: nextToken,
  };
}

type UploadBody = {
  documents: Array<{
    file: File;
    name: string;
    tags?: string[];
  }>;
  category: string;
};

function buildUploadResponse(body: UploadBody) {
  const filenames: string[] = [];
  let totalSize = 0;

  for (const doc of body.documents) {
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
    uploadedCount: body.documents.length,
    totalSize,
    filenames,
  };
}

async function buildDownloadResponse(fileId: string) {
  if (fileId === 'test-image') {
    const bunFile = Bun.file('./tests/fixtures/test-image.png');
    const buffer = await bunFile.arrayBuffer();
    return {
      status: 200 as const,
      body: new File([buffer], 'test-image.png', { type: bunFile.type }),
    };
  }

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

  const fileInfo = mockFiles[fileId];
  if (!fileInfo) {
    return {
      status: Status.NotFound,
      body: {
        error: 'Not Found',
        message: `File with id ${fileId} not found`,
      },
    } as const;
  }

  return {
    status: 200 as const,
    body: new File([fileInfo.content], fileInfo.name, {
      type: fileInfo.type,
    }),
  };
}

function withResponseHeader(response: Response, key: string, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set(key, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Create router with handlers and context
const router = createRouter<typeof usersContract, AppContext>(
  usersContract,
  {
    listUsers: async ({ query }) => {
      const limit = query?.limit ? parseInt(query.limit, 10) : 100;
      const offset = query?.offset ? parseInt(query.offset, 10) : 0;

      return {
        status: Status.OK,
        body: buildUserList(limit, offset),
      };
    },

    authListUsers: async ({ request }) => {
      const headers = getDemoSessionHeaders(request.headers.get('authorization'), 'standard');
      if (!headers) {
        return createUnauthorizedResponse('standard');
      }

      return {
        status: Status.OK,
        body: buildUserList(),
        headers,
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
      return {
        status: Status.Created,
        body: buildUploadResponse(body as UploadBody),
      };
    },

    authUploadDocuments: async ({ body, request }) => {
      const headers = getDemoSessionHeaders(request.headers.get('authorization'), 'upload');
      if (!headers) {
        return createUnauthorizedResponse('upload');
      }

      return {
        status: Status.Created,
        body: buildUploadResponse(body as UploadBody),
        headers,
      };
    },

    // File download
    downloadFile: async ({ params }) => {
      return buildDownloadResponse(params.fileId);
    },

    authDownloadFile: async ({ params, request }) => {
      const headers = getDemoSessionHeaders(request.headers.get('authorization'), 'download');
      if (!headers) {
        return createUnauthorizedResponse('download');
      }

      const response = await buildDownloadResponse(params.fileId);
      return {
        ...response,
        headers,
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
    '/auth-hooks.html': authHooksHtml,
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
        if (url.pathname === '/streaming/auth/chat') {
          const nextToken = getNextDemoSessionToken(
            request.headers.get('authorization'),
            'streaming',
          );
          if (!nextToken) {
            return Response.json(createUnauthorizedResponse('streaming').body, { status: 401 });
          }

          const response = await streamingRouter.handle(request);
          return withResponseHeader(response, DEMO_SESSION_HEADER, nextToken);
        }

        const response = await streamingRouter.handle(request);
        return response;
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
