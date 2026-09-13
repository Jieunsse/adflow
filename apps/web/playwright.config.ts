import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
  },
});
