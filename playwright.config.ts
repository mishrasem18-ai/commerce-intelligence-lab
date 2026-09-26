import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the PRODUCTION build served by the local
 * OpenNext/Wrangler preview (the same runtime as Cloudflare, with local D1).
 *
 *   npm run e2e                 # builds + serves on :8787 if not already up
 *   PW_BASE_URL=http://localhost:8787 npm run e2e   # reuse a running preview
 *
 * Admin specs sign in with ADMIN_EMAIL / ADMIN_PASSWORD from .env.local.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional: admin specs skip without credentials */
}

const PORT = 8787;
const baseURL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Specs share one local D1 database and module-level analytics state per
  // page; a couple of workers keeps runs fast without contention.
  workers: 2,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "npm run preview",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 15 * 60_000,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
});
