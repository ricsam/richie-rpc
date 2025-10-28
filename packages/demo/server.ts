import { createDocsResponse, generateOpenAPISpec } from '@rfetch/openapi';
import { createRouter } from '@rfetch/server';
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

// Create router with handlers
const router = createRouter(usersContract, {
  listUsers: async ({ query }) => {
    const limit = query?.limit ? parseInt(query.limit) : 100;
    const offset = query?.offset ? parseInt(query.offset) : 0;

    const allUsers = Array.from(users.values());
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    return {
      status: 200,
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
        status: 404,
        body: {
          error: 'Not Found',
          message: `User with id ${params.id} not found`,
        },
      };
    }

    return {
      status: 200,
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
      status: 201,
      body: user,
    };
  },

  updateUser: async ({ params, body }) => {
    const user = users.get(params.id);

    if (!user) {
      return {
        status: 404,
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
      status: 200,
      body: updatedUser,
    };
  },

  deleteUser: async ({ params }) => {
    const user = users.get(params.id);

    if (!user) {
      return {
        status: 404,
        body: {
          error: 'Not Found',
          message: `User with id ${params.id} not found`,
        },
      };
    }

    users.delete(params.id);

    return {
      status: 204,
      body: {},
    };
  },
});

// Generate OpenAPI spec
const openAPISpec = generateOpenAPISpec(usersContract, {
  info: {
    title: 'Users API',
    version: '1.0.0',
    description: 'A simple user management API',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
});

// Create docs HTML
const docsHtml = createDocsResponse('/openapi.json', {
  title: 'Users API Documentation',
});

// Start server
const server = Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);

    // Serve OpenAPI spec
    if (url.pathname === '/openapi.json') {
      return Response.json(openAPISpec);
    }

    // Serve API docs
    if (url.pathname === '/docs') {
      return docsHtml;
    }

    // Handle API routes
    return router.fetch(request);
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`📚 API Docs available at http://localhost:${server.port}/docs`);
console.log(`📄 OpenAPI Spec at http://localhost:${server.port}/openapi.json`);
