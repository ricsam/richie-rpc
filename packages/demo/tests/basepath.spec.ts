import { type ChildProcess, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createClient } from '@richie-rpc/client';
import { usersContract } from '../contract';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PORT = 3100;
let serverProcess: ChildProcess | null = null;

test.beforeAll(async () => {
  // Start the basePath server as a subprocess
  const serverPath = join(__dirname, '..', 'server-basepath.ts');
  serverProcess = spawn('bun', ['run', serverPath], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore',
  });

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

test.describe('BasePath Support', () => {
  test('client can make requests to server with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    const response = await client.listUsers({});
    expect(response.status).toBe(200);
    expect(response.data.users.length).toBeGreaterThanOrEqual(2);
    expect(response.data.total).toBeGreaterThanOrEqual(2);
  });

  test('client can get a single user with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    const response = await client.getUser({ params: { id: '1' } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.data.id).toBe('1');
      expect(response.data.name).toBeTruthy();
    }
  });

  test('client can create a user with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    const response = await client.createUser({
      body: {
        name: 'New User',
        email: 'new@example.com',
        age: 30,
      },
    });

    expect(response.status).toBe(201);
    if (response.status === 201) {
      expect(response.data.name).toBe('New User');
      expect(response.data.email).toBe('new@example.com');
    }
  });

  test('client can update a user with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    const response = await client.updateUser({
      params: { id: '1' },
      body: { name: 'Updated User' },
    });

    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.data.name).toBe('Updated User');
    }
  });

  test('client can delete a user with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    // First, get the initial count
    const initialList = await client.listUsers({});
    const initialCount = initialList.data.total;

    const response = await client.deleteUser({ params: { id: '1' } });
    expect(response.status).toBe(204);

    // Verify user is deleted - count should be reduced by 1
    const listResponse = await client.listUsers({});
    expect(listResponse.data.total).toBe(initialCount - 1);

    // Verify the specific user is gone
    const getResponse = await client.getUser({ params: { id: '1' } });
    expect(getResponse.status).toBe(404);
  });

  test('requests without basePath prefix return 404', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/users`);
    expect(response.status).toBe(404);
  });

  test('OpenAPI spec includes basePath in all paths', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/openapi.json`);
    expect(response.status).toBe(200);

    const spec = (await response.json()) as any;
    const paths = Object.keys(spec.paths);

    // All paths should start with /api
    for (const path of paths) {
      expect(path).toMatch(/^\/api\//);
    }

    // Verify specific paths
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users/{id}']).toBeDefined();
    expect(spec.paths['/api/teapot']).toBeDefined();
  });

  test('server correctly strips basePath before matching routes', async () => {
    // Direct fetch to test server routing
    const response = await fetch(`http://localhost:${TEST_PORT}/api/users`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as any;
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
  });

  test('handles 404 for non-existent routes under basePath', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/nonexistent`);
    expect(response.status).toBe(404);
  });

  test('client with trailing slash in baseUrl works correctly', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api/`, // Note the trailing slash
    });

    const response = await client.listUsers({});
    expect(response.status).toBe(200);
    expect(response.data.users).toBeDefined();
  });

  test('router handles basePath normalization', async () => {
    // This test verifies that the router normalizes basePath correctly
    // by testing through HTTP requests to our test server

    // Test that accessing without basePath returns 404
    const withoutBasePath = await fetch(`http://localhost:${TEST_PORT}/users`);
    expect(withoutBasePath.status).toBe(404);

    // Test that accessing with correct basePath works
    const withBasePath = await fetch(`http://localhost:${TEST_PORT}/api/users`);
    expect(withBasePath.status).toBe(200);
  });

  test('full CRUD workflow with basePath', async () => {
    const client = createClient(usersContract, {
      baseUrl: `http://localhost:${TEST_PORT}/api`,
    });

    // Create
    const createResponse = await client.createUser({
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 35,
      },
    });
    expect(createResponse.status).toBe(201);
    if (createResponse.status !== 201) return;
    const userId = createResponse.data.id;

    // Read
    const getResponse = await client.getUser({ params: { id: userId } });
    expect(getResponse.status).toBe(200);
    if (getResponse.status === 200) {
      expect(getResponse.data.name).toBe('John Doe');
    }

    // Update
    const updateResponse = await client.updateUser({
      params: { id: userId },
      body: { age: 36 },
    });
    expect(updateResponse.status).toBe(200);
    if (updateResponse.status === 200) {
      expect(updateResponse.data.age).toBe(36);
    }

    // List
    const listResponse = await client.listUsers({});
    expect(listResponse.status).toBe(200);
    expect(listResponse.data.total).toBeGreaterThanOrEqual(1);

    // Delete
    const deleteResponse = await client.deleteUser({ params: { id: userId } });
    expect(deleteResponse.status).toBe(204);

    // Verify deletion
    const getAfterDeleteResponse = await client.getUser({ params: { id: userId } });
    expect(getAfterDeleteResponse.status).toBe(404);
  });
});
