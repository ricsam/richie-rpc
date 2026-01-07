import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts', // Only match .e2e.ts files for Playwright
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:14232',
    trace: {
      mode: 'on',
      // Save traces to test-results directory
      // You can view them with: npx playwright show-trace <trace-file>
    },
  },
  // Configure where test artifacts (including traces) are saved
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'PORT=14232 bun run server.ts',
    url: 'http://localhost:14232/openapi.json',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
