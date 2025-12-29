import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
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
        baseURL: 'https://www.adult-v.com',
      },
    },
    {
      name: 'fanza',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://www.f.adult-v.com',
      },
    },
  ],
});
