import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { createRouter, Status } from '@richie-rpc/server';
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
    teapot: async () => {
      return {
        status: 418 as const,
        body: {
          message: "I'm a teapot! I cannot brew coffee.",
          isTeapot: true,
        },
      };
    },
  },
  { basePath: '/api' },
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
  fetch(request) {
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
      return router.fetch(request);
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
