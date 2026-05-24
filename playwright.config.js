import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:9000',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:9000',
    reuseExistingServer: true,
    timeout: 60000,
  },
  snapshotDir: 'tests/e2e/screenshots',
});
