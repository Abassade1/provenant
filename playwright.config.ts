import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for the six MVP success steps (brief §2, docs/02-user-stories.md).
 * Runs against the dev server on seeded demo data — deterministic and
 * fixture-based, no live network required. `npm run test:e2e` migrates and
 * reseeds first.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared demo DB — journeys shouldn't race each other
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
