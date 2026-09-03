import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.MARKETING_E2E_BASE_URL ?? "http://127.0.0.1:3013";
const runFullBrowserMatrix =
  process.env.MARKETING_E2E_FULL_BROWSER_MATRIX === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: process.env.CI_RELEASE_GATE === "true",
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(runFullBrowserMatrix
      ? [
          {
            name: "mobile-safari",
            grep: /@compat/,
            use: { ...devices["iPhone 15"] },
          },
        ]
      : []),
  ],
  webServer: {
    command: [
      "pnpm --workspace-root exec turbo run build --filter=marketing-web^...",
      "pnpm exec next build",
      "pnpm exec next start -p 3013 -H 127.0.0.1",
    ].join(" && "),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
