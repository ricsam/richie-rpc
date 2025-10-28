import { expect, test } from '@playwright/test';

test.describe('Richie RPC API Integration', () => {
  test('should serve OpenAPI spec at /openapi.json', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.ok()).toBeTruthy();

    const spec = await response.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Users API');
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/users/{id}']).toBeDefined();
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
    const listResponse = await request.get('/users');
    expect(listResponse.ok()).toBeTruthy();
    const listData = await listResponse.json();
    expect(listData.users).toBeDefined();
    expect(Array.isArray(listData.users)).toBeTruthy();

    // Get a user
    const getUserResponse = await request.get('/users/1');
    expect(getUserResponse.ok()).toBeTruthy();
    const user = await getUserResponse.json();
    expect(user.id).toBe('1');
    expect(user.name).toBeDefined();
    expect(user.email).toBeDefined();

    // Create a user
    const createResponse = await request.post('/users', {
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
    const updateResponse = await request.put(`/users/${newUserId}`, {
      data: {
        age: 26,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = await updateResponse.json();
    expect(updatedUser.age).toBe(26);

    // Delete the user
    const deleteResponse = await request.delete(`/users/${newUserId}`);
    expect(deleteResponse.status()).toBe(204);

    // Verify deletion (should 404)
    const getDeletedResponse = await request.get(`/users/${newUserId}`);
    expect(getDeletedResponse.status()).toBe(404);
  });

  test('should validate request data', async ({ request }) => {
    // Invalid email
    const response = await request.post('/users', {
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
    const response = await request.get('/users/999999');
    expect(response.status()).toBe(404);
    const error = await response.json();
    expect(error.error).toBe('Not Found');
  });

  test('should support pagination in list endpoint', async ({ request }) => {
    const response = await request.get('/users?limit=1&offset=0');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.users.length).toBeLessThanOrEqual(1);
    expect(data.total).toBeGreaterThan(0);
  });
});

test.describe('Scalar API Documentation UI', () => {
  test('should display API endpoints in docs UI', async ({ page }) => {
    await page.goto('/docs');

    // Verify the page has the title
    const title = await page.title();
    expect(title).toBe('Users API Documentation');

    // Wait for the #app div to be present in the HTML
    const appDiv = await page.locator('#app').count();
    expect(appDiv).toBe(1);

    // Verify the script tag is present
    const scriptTag = await page.locator('script[src*="scalar"]').count();
    expect(scriptTag).toBeGreaterThan(0);

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/docs-ui.png', fullPage: true });
  });
});
