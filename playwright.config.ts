import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real web app against the real API and database.
 * Locally: `npm run seed -- --reset` once, then `npm run test:e2e` (starts both dev servers
 * unless they are already running). Point E2E_BASE_URL elsewhere to test a deployment.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev -w @novafood/api', url: 'http://localhost:4000/api/health', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run dev -w @novafood/web', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
      ],
});
