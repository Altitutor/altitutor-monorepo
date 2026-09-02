import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function readLocalSupabaseEnvironment() {
  if (
    process.env.STUDENT_E2E_SUPABASE_URL &&
    process.env.STUDENT_E2E_PUBLIC_KEY &&
    process.env.STUDENT_E2E_SERVICE_ROLE_KEY
  ) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.STUDENT_E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.STUDENT_E2E_PUBLIC_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.STUDENT_E2E_SERVICE_ROLE_KEY,
    };
  }

  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  });
  const values = Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replace(/^"|"$/g, ""),
        ];
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
  process.env.STUDENT_E2E_SUPABASE_URL = url;
  process.env.STUDENT_E2E_PUBLIC_KEY = publicKey;
  process.env.STUDENT_E2E_SERVICE_ROLE_KEY = serviceKey;
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };
}

const baseURL = process.env.STUDENT_E2E_BASE_URL ?? "http://127.0.0.1:3011";
const runFullBrowserMatrix =
  process.env.STUDENT_E2E_FULL_BROWSER_MATRIX === "true";

const compatibilityProjects = runFullBrowserMatrix
  ? [
      {
        name: "desktop-safari",
        grep: /@compat/,
        use: { ...devices["Desktop Safari"] },
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
    ...compatibilityProjects,
  ],
  webServer: {
    command: [
      "pnpm --workspace-root exec turbo run build --filter=student-web^...",
      "pnpm exec next build",
      "pnpm exec next start -p 3011 -H 127.0.0.1",
    ].join(" && "),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...readLocalSupabaseEnvironment(),
      NEXT_PUBLIC_ADMIN_PORTAL_URL: "http://localhost:3000",
      NEXT_PUBLIC_TUTOR_PORTAL_URL: "http://localhost:3002",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
