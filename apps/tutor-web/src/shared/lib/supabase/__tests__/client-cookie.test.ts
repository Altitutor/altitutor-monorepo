const mockCreateBrowserClient = jest.fn(() => ({}));

jest.mock("@supabase/ssr", () => ({ createBrowserClient: mockCreateBrowserClient }));
jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: <T>(client: T) => client,
}));

const previous = { ...process.env };
afterEach(() => { process.env = { ...previous }; });

it.each([undefined, "isolated-project-app-auth"])(
  "uses matching browser cookie storage for the configured namespace (%s)",
  async (override) => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:59999";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-public-key";
    if (override === undefined) delete process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME;
    else process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME = override;
    await jest.isolateModulesAsync(async () => {
      const { getSupabaseClient } = await import("../client");
      getSupabaseClient();
    });
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "http://127.0.0.1:59999",
      "fixture-public-key",
      expect.objectContaining({ cookieOptions: { name: override || "tutor-auth" } }),
    );
  },
);
