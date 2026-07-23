import { defineConfig, devices } from '@playwright/test';

// One end-to-end smoke of the real critical path (anonymous auth → demo seeding →
// data load → costing). Runs against the Vite dev server, which loads .env for
// the Supabase connection; CI provides the same vars from repository secrets.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
