import { defineConfig } from "@playwright/test";

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`;
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: `PORT=${playwrightPort} NEXTAUTH_URL=http://localhost:${playwrightPort} pnpm dev`,
          url: `${baseURL}/login`,
          reuseExistingServer: false,
        },
      }),
});
