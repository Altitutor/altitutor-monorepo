const createBrowserClient = jest.fn(
  (_url: string, _key: string, _options: unknown) => ({ auth: {} }),
);

jest.mock("@supabase/ssr", () => ({
  createBrowserClient: (url: string, key: string, options: unknown) =>
    createBrowserClient(url, key, options),
}));

jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: <Client>(client: Client) => client,
}));

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  });

  it("leaves PKCE callback exchange to the callback route", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    getSupabaseBrowserClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: { detectSessionInUrl: false },
      }),
    );
  });
});
