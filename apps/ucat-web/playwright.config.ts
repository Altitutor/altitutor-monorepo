import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function readLocalSupabaseEnvironment() {
  if (
    process.env.UCAT_E2E_SUPABASE_URL &&
    process.env.UCAT_E2E_PUBLIC_KEY &&
    process.env.UCAT_E2E_SERVICE_ROLE_KEY
  ) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.UCAT_E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.UCAT_E2E_PUBLIC_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.UCAT_E2E_SERVICE_ROLE_KEY,
    };
  }
  const repositoryRoot = path.resolve(__dirname, "../..");
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const values = Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, "");
        return [key, value];
      }),
  );
  const url = values.API_URL;
  const publicKey = values.ANON_KEY ?? values.PUBLISHABLE_KEY;
  const serviceKey = values.SERVICE_ROLE_KEY ?? values.SECRET_KEY;
  if (!url || !publicKey || !serviceKey) {
    throw new Error(
      "Local Supabase is missing an API URL, public key, or service key.",
    );
  }
  process.env.UCAT_E2E_SUPABASE_URL = url;
  process.env.UCAT_E2E_PUBLIC_KEY = publicKey;
  process.env.UCAT_E2E_SERVICE_ROLE_KEY = serviceKey;
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };
}

const localSupabase = readLocalSupabaseEnvironment();
const baseURL = process.env.UCAT_E2E_BASE_URL ?? "http://localhost:3014";
const runFullBrowserMatrix =
  process.env.UCAT_E2E_FULL_BROWSER_MATRIX === "true";

const compatibilityProjects = runFullBrowserMatrix
  ? [
      {
        name: "desktop-chrome",
        grep: /@compat/,
        use: { ...devices["Desktop Chrome"], channel: "chrome" },
      },
      {
        name: "desktop-edge",
        grep: /@compat/,
        use: { ...devices["Desktop Chrome"], channel: "msedge" },
      },
      {
        name: "desktop-firefox",
        grep: /@compat/,
        use: { ...devices["Desktop Firefox"] },
      },
      {
        name: "desktop-safari",
        grep: /@compat/,
        use: { ...devices["Desktop Safari"] },
      },
      {
        name: "mobile-android",
        grep: /@compat/,
        use: { ...devices["Pixel 7"] },
      },
      {
        name: "mobile-ios",
        grep: /@compat/,
        use: { ...devices["iPhone 15"] },
      },
    ]
  : [];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
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
    ...compatibilityProjects,
  ],
  webServer: {
    command: [
      "pnpm --workspace-root exec turbo run build --filter=ucat-web^...",
      "pnpm exec next build",
      "pnpm exec next start -p 3014 -H 127.0.0.1",
    ].join(" && "),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...localSupabase,
      CRON_SECRET: "local-playwright-cron-secret",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
