import { defineConfig, devices } from "@playwright/test";

const port = 3101;

// En local : Google Chrome installé (pas de téléchargement). En CI : `playwright install chromium`.
const channel = process.env.CI ? undefined : "chrome";

/**
 * Tests fonctionnels de bout en bout sur le build de production (port 3101, pas de
 * rechargement Vite), avec la base TEST_DATABASE_URL (script `e2e:serve`), jamais la base de dev.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, testMatch: /navigation\.spec\.ts/ },
  ],
  webServer: {
    command: "bun run e2e:serve",
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
