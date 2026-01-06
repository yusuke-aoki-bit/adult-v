import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 1, // Add 1 retry for flaky tests in dev
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: 'list',
  // Increase default timeout for dev environment (Next.js cold starts can be slow)
  timeout: process.env['CI'] ? 60000 : 120000,
  expect: {
    // Increase expect timeout for slow dev environment
    timeout: process.env['CI'] ? 10000 : 30000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Increase navigation timeout for dev environment
    navigationTimeout: process.env['CI'] ? 30000 : 60000,
    // Increase action timeout for dev environment
    actionTimeout: process.env['CI'] ? 15000 : 30000,
  },

  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'fanza',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
      },
    },
  ],

  /* テスト実行前にサーバーを自動起動 */
  webServer: [
    {
      command: 'pnpm run dev:web',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: true, // 既存サーバーを優先使用
    },
    {
      command: 'pnpm run dev:fanza',
      url: 'http://localhost:3001',
      timeout: 120000,
      reuseExistingServer: true, // 既存サーバーを優先使用
    },
  ],
});
