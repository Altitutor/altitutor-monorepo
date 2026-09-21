/** @jest-environment node */
const cookieClient = { auth: { getUser: jest.fn() } };
const makeCookieClient = jest.fn(() => cookieClient);
const getHeaders = jest.fn(() => new Headers());
const getCookies = jest.fn(() => ({
  getAll: () => [{ name: "student-auth", value: "browser-session" }],
  set: jest.fn(),
}));
jest.mock("next/headers", () => ({
  headers: () => getHeaders(),
  cookies: () => getCookies(),
}));
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => makeCookieClient(),
}));
jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: <T>(client: T) => client,
}));
import { getSupabaseServerClient } from "../server";
const original = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  delete process.env.NEXT_PHASE;
  getHeaders.mockReturnValue(new Headers());
});
afterAll(() => {
  process.env = original;
});
test("browser requests preserve cookie authentication", async () => {
  const client = await getSupabaseServerClient();
  expect(client).toBe(cookieClient);
  expect(getCookies).toHaveBeenCalledTimes(1);
  expect(makeCookieClient).toHaveBeenCalledTimes(1);
});
test("native requests verify the supplied bearer token with Auth and never read browser cookies", async () => {
  getHeaders.mockReturnValue(
    new Headers({ Authorization: "Bearer native-token" }),
  );
  const fetcher = jest.fn(async (_url: unknown, options?: RequestInit) => {
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer native-token",
    );
    return new Response(
      JSON.stringify({
        id: "verified-user",
        aud: "authenticated",
        role: "authenticated",
        email: "student@example.test",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  const client = await getSupabaseServerClient(fetcher as typeof fetch);
  const { data, error } = await client.auth.getUser();
  expect(error).toBeNull();
  expect(data.user?.id).toBe("verified-user");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getCookies).not.toHaveBeenCalled();
  expect(makeCookieClient).not.toHaveBeenCalled();
});
test("invalid bearer credentials cannot fall back to a valid browser cookie", async () => {
  getHeaders.mockReturnValue(
    new Headers({ Authorization: "Bearer rejected-token" }),
  );
  const fetcher = jest.fn(
    async () =>
      new Response(
        JSON.stringify({ message: "Invalid JWT", code: "bad_jwt" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
  );
  const client = await getSupabaseServerClient(fetcher as typeof fetch);
  const { data, error } = await client.auth.getUser();
  expect(data.user).toBeNull();
  expect(error).not.toBeNull();
  expect(getCookies).not.toHaveBeenCalled();
});
