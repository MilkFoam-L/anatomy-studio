import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: process.env.ANATOMY_API_KEY ? ["e2e/**/*.spec.ts", "live/**/*.spec.ts"] : ["e2e/**/*.spec.ts"],
  timeout: 240_000,
  use: { baseURL: process.env.PW_BASE_URL ?? "http://localhost:5199", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run bundle:skill && npm run build:runtime && STUDIO_NO_HMR=1 npx vite --port 5199 --strictPort",
    url: "http://localhost:5199/tests/harness/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
