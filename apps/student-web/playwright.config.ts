import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function readLocalSupabaseEnvironment() {
  if (
    process.env.STUDENT_E2E_SUPABASE_URL &&
    process.env.STUDENT_E2E_PUBLIC_KEY
  ) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.STUDENT_E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.STUDENT_E2E_PUBLIC_KEY,
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
  if (!url || !publicKey) {
    throw new Error("Local Supabase is missing an API URL or public key.");
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
  };
}

const baseURL = process.env.STUDENT_E2E_BASE_URL ?? "http://127.0.0.1:3011";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "pnpm exec next dev -p 3011 -H 127.0.0.1",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...readLocalSupabaseEnvironment(),
      NEXT_PUBLIC_ADMIN_PORTAL_URL: "http://localhost:3000",
      NEXT_PUBLIC_TUTOR_PORTAL_URL: "http://localhost:3002",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
