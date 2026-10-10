import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.UCAT_LOGIN_RECOVERY_BASE_URL ?? "http://127.0.0.1:39141";
const port = new URL(baseURL).port;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "login-chunk-recovery.spec.ts",
  workers: 1,
  retries: 0,
  use: { baseURL, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 300000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-login-fixture",
      SUPABASE_SERVICE_ROLE_KEY: "local-login-fixture",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_fake",
    },
  },
});
