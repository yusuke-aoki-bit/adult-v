import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
      command: 'npm run dev:web',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'SITE_MODE=fanza npm run dev:web -- --port 3001',
      url: 'http://localhost:3001',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: {
        SITE_MODE: 'fanza',
      },
    },
  ],
});
