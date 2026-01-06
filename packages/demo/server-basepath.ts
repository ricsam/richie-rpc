import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { createRouter, RouteNotFoundError, Status, ValidationError } from '@richie-rpc/server';
import { type User, usersContract } from './contract';

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

// Create router with basePath
const router = createRouter(
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

    getUser: async ({ params }) => {
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
        filenames.push(doc.file.name);
        totalSize += doc.file.size;
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
      const mockFiles: Record<string, { content: string; name: string; type: string }> = {
        'doc-1': { content: 'Hello, World!', name: 'hello.txt', type: 'text/plain' },
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

      const file = new File([fileInfo.content], fileInfo.name, { type: fileInfo.type });

      return {
        status: 200 as const,
        body: file,
      };
    },
  },
  {
    basePath: '/api',
    context: async () => {
      return {
        appName: 'Richie RPC Demo',
        version: '1.0.0',
        features: {
          darkMode: true,
        },
      };
    },
  },
);

// Generate OpenAPI spec with basePath
const openAPISpec = generateOpenAPISpec(usersContract, {
  info: {
    title: 'Users API',
    version: '1.0.0',
    description: 'A simple user management API served under /api basePath',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server',
    },
  ],
  basePath: '/api',
});

// Create docs HTML
const docsHtml = createDocsResponse('/api/openapi.json', {
  title: 'Users API Documentation (with basePath)',
});

// Start server
const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Serve OpenAPI spec at /api/openapi.json
    if (url.pathname === '/api/openapi.json') {
      return Response.json(openAPISpec);
    }

    // Serve API docs at /api/docs
    if (url.pathname === '/api/docs') {
      return docsHtml;
    }

    // Handle all /api/* routes through the router
    if (url.pathname.startsWith('/api/')) {
      try {
        return await router.handle(request);
      } catch (error) {
        if (error instanceof ValidationError) {
          return Response.json(
            {
              error: 'Validation Error',
              field: error.field,
              issues: error.issues,
            },
            { status: 400 },
          );
        }
        if (error instanceof RouteNotFoundError) {
          return Response.json({ error: 'Not Found' }, { status: 404 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    // 404 for everything else
    return Response.json(
      { error: 'Not Found', message: 'API is served under /api prefix' },
      { status: 404 },
    );
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`📚 API Docs available at http://localhost:${server.port}/api/docs`);
console.log(`📄 OpenAPI Spec at http://localhost:${server.port}/api/openapi.json`);
console.log(`🔧 API endpoints are under /api (e.g., http://localhost:${server.port}/api/users)`);
