const originalGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

const createBrowserClient = jest.fn(
  (_url: string, _key: string, _options: unknown) => ({
    auth: {
      getSession: originalGetSession,
      signInWithPassword: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  }),
);

jest.mock("@supabase/ssr", () => ({
  createBrowserClient: (url: string, key: string, options: unknown) =>
    createBrowserClient(url, key, options),
}));

jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: <Client>(client: Client) => client,
}));
jest.mock("@sentry/nextjs", () => ({
  addEventProcessor: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalSentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

describe("getSupabaseBrowserClient", () => {
  afterAll(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
    if (originalSentryDsn === undefined)
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = originalSentryDsn;
  });

  it("leaves PKCE callback exchange to the callback route and wires the diagnostic fetch", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/1";

    const client = getSupabaseBrowserClient();

    expect(client.auth.getSession).not.toBe(originalGetSession);

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: { detectSessionInUrl: false },
        global: { fetch: expect.any(Function) },
      }),
    );
  });
});
