import { expect, test } from '@playwright/test';

test.describe('Richie RPC API Integration', () => {
  test('should serve OpenAPI spec at /openapi.json', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.ok()).toBeTruthy();

    const spec = await response.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Users API');
    expect(spec.paths).toBeDefined();
    // Check for paths - they should have /api prefix from the basePath
    const pathKeys = Object.keys(spec.paths);
    expect(pathKeys.some((p) => p.includes('/users'))).toBeTruthy();
    expect(pathKeys.some((p) => p.includes('/users/{id}'))).toBeTruthy();
  });

  test('should serve API documentation at /docs', async ({ page }) => {
    await page.goto('/docs');

    // Wait for Scalar to load
    await page.waitForSelector('#app', { timeout: 5000 });

    // Check that the title is correct (our custom title)
    await expect(page).toHaveTitle('Users API Documentation');

    // Check that content loaded (Scalar should inject content)
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content?.length).toBeGreaterThan(100);
  });

  test('should perform full CRUD operations', async ({ request }) => {
    // List users
    const listResponse = await request.get('/api/users');
    expect(listResponse.ok()).toBeTruthy();
    const listData = await listResponse.json();
    expect(listData.users).toBeDefined();
    expect(Array.isArray(listData.users)).toBeTruthy();

    // Get a user
    const getUserResponse = await request.get('/api/users/1');
    expect(getUserResponse.ok()).toBeTruthy();
    const user = await getUserResponse.json();
    expect(user.id).toBe('1');
    expect(user.name).toBeDefined();
    expect(user.email).toBeDefined();

    // Create a user
    const createResponse = await request.post('/api/users', {
      data: {
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
      },
    });
    expect(createResponse.status()).toBe(201);
    const newUser = await createResponse.json();
    expect(newUser.id).toBeDefined();
    expect(newUser.name).toBe('Test User');
    expect(newUser.email).toBe('test@example.com');
    const newUserId = newUser.id;

    // Update the user
    const updateResponse = await request.put(`/api/users/${newUserId}`, {
      data: {
        age: 26,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = await updateResponse.json();
    expect(updatedUser.age).toBe(26);

    // Delete the user
    const deleteResponse = await request.delete(`/api/users/${newUserId}`);
    expect(deleteResponse.status()).toBe(204);

    // Verify deletion (should 404)
    const getDeletedResponse = await request.get(`/api/users/${newUserId}`);
    expect(getDeletedResponse.status()).toBe(404);
  });

  test('should validate request data', async ({ request }) => {
    // Invalid email
    const response = await request.post('/api/users', {
      data: {
        name: 'Invalid User',
        email: 'not-an-email',
        age: 25,
      },
    });
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBe('Validation Error');
    expect(error.field).toBe('body');
  });

  test('should return 404 for non-existent user', async ({ request }) => {
    const response = await request.get('/api/users/999999');
    expect(response.status()).toBe(404);
    const error = await response.json();
    expect(error.error).toBe('Not Found');
  });

  test('should support pagination in list endpoint', async ({ request }) => {
    const response = await request.get('/api/users?limit=1&offset=0');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.users.length).toBeLessThanOrEqual(1);
    expect(data.total).toBeGreaterThan(0);
  });
});

test.describe('OpenAPI Spec Validation', () => {
  test('should match OpenAPI spec with actual endpoint behavior', async ({ request }) => {
    // Fetch the OpenAPI spec
    const specResponse = await request.get('/openapi.json');
    expect(specResponse.ok()).toBeTruthy();
    const spec = await specResponse.json();

    // Test each endpoint defined in the spec
    const paths = spec.paths;

    // Test GET /api/users (from spec)
    if (paths['/api/users']?.get) {
      const getUsersOp = paths['/api/users'].get;
      expect(getUsersOp.operationId).toBe('listUsers');
      expect(getUsersOp.responses['200']).toBeDefined();

      // Test the actual endpoint
      const response = await request.get('/api/users');
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBeTruthy();
    }

    // Test GET /api/users/{id} (from spec)
    if (paths['/api/users/{id}']?.get) {
      const getUserOp = paths['/api/users/{id}'].get;
      expect(getUserOp.operationId).toBe('getUser');
      expect(getUserOp.responses['200']).toBeDefined();
      expect(getUserOp.responses['404']).toBeDefined();

      // Test the actual endpoint with valid ID
      const validResponse = await request.get('/api/users/1');
      expect([200, 404]).toContain(validResponse.status());
    }

    // Test POST /api/users (from spec)
    if (paths['/api/users']?.post) {
      const createUserOp = paths['/api/users'].post;
      expect(createUserOp.operationId).toBe('createUser');
      expect(createUserOp.requestBody).toBeDefined();
      expect(createUserOp.responses['201']).toBeDefined();

      // Verify request body schema exists
      const requestBody = createUserOp.requestBody;
      expect(requestBody.content['application/json'].schema).toBeDefined();
    }

    // Test PUT /api/users/{id} (from spec)
    if (paths['/api/users/{id}']?.put) {
      const updateUserOp = paths['/api/users/{id}'].put;
      expect(updateUserOp.operationId).toBe('updateUser');
      expect(updateUserOp.responses['200']).toBeDefined();
      expect(updateUserOp.responses['404']).toBeDefined();
    }

    // Test DELETE /api/users/{id} (from spec)
    if (paths['/api/users/{id}']?.delete) {
      const deleteUserOp = paths['/api/users/{id}'].delete;
      expect(deleteUserOp.operationId).toBe('deleteUser');
      expect(deleteUserOp.responses['204']).toBeDefined();
      expect(deleteUserOp.responses['404']).toBeDefined();
    }

    // Verify all operations have proper structure
    for (const [_path, methods] of Object.entries(paths)) {
      for (const [_method, operation] of Object.entries(methods as Record<string, any>)) {
        expect(operation.operationId).toBeDefined();
        expect(operation.responses).toBeDefined();
        expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
      }
    }
  });
});
