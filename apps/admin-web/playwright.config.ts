import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function readLocalSupabaseEnvironment() {
  if (process.env.ADMIN_E2E_SUPABASE_URL && process.env.ADMIN_E2E_PUBLIC_KEY) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.ADMIN_E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.ADMIN_E2E_PUBLIC_KEY,
    };
  }

  const repositoryRoot = path.resolve(__dirname, '../..');
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  const values = Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, '');
        return [key, value];
      })
  );
  const url = values.API_URL;
  const publicKey = values.ANON_KEY ?? values.PUBLISHABLE_KEY;
  if (!url || !publicKey) {
    throw new Error('Local Supabase is missing an API URL or public key.');
  }

  process.env.ADMIN_E2E_SUPABASE_URL = url;
  process.env.ADMIN_E2E_PUBLIC_KEY = publicKey;
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
  };
}

const localSupabase = readLocalSupabaseEnvironment();
const baseURL = process.env.ADMIN_E2E_BASE_URL ?? 'http://127.0.0.1:3010';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev -p 3010 -H 127.0.0.1',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...localSupabase,
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});
