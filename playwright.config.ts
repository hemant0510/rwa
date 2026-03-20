import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for RWA Connect.
 *
 * Prerequisites:
 *   - Set TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD env vars (or use .env.test.local)
 *   - Run `npm run dev` or set webServer below to auto-start
 *
 * Run: npx playwright test
 * UI:  npx playwright test --ui
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // society-scoped DB state — run serially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Auto-start dev server when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
