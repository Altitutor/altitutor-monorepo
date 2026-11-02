/** @jest-environment node */

import { NextRequest } from "next/server";
import { middleware } from "../middleware";

// Telemetry is an external boundary; Supabase and the application adapter stay real.
jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn() }));

const userId = "10000000-0000-0000-0000-000000000001";
const authUrl = "https://auth.sdk-contract.test";
const user = { id: userId, aud: "authenticated", email: "student@local.test" };
function token(expiresAt: number) {
  return [
    { alg: "HS256", typ: "JWT" },
    { sub: userId, aud: "authenticated", exp: expiresAt, iat: expiresAt - 3600 },
  ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .concat(Buffer.from("external-auth-verifies-this-fixture").toString("base64url")).join(".");
}

it("a refreshed chunked session reaches the next protected request with cache protection", async () => {
  const originalFetch = global.fetch;
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookie: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = token(expiresAt);
  process.env.NEXT_PUBLIC_SUPABASE_URL = authUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-public-key";
  process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME = "sdk-contract-auth";
  const expiredSession = { access_token: token(1), refresh_token: "old-refresh",
    expires_at: 1, expires_in: 3600, token_type: "bearer", user };
  const encoded = "base64-" + Buffer.from(JSON.stringify(expiredSession)).toString("base64url");
  const requests: string[] = [];
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== authUrl) throw new Error("Unexpected external request");
    requests.push(url.pathname);
    if (url.pathname === "/auth/v1/token") {
      expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "old-refresh" });
      return Response.json({ access_token: accessToken, refresh_token: "rotated-refresh",
        expires_in: 3600, token_type: "bearer",
        user: { ...user, user_metadata: { fixture: "x".repeat(5000) } } });
    }
    if (url.pathname === "/auth/v1/user") {
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${accessToken}`);
      return Response.json(user);
    }
    throw new Error("Unexpected Auth endpoint");
  };
  try {
    const request = new NextRequest("https://ucat.local.test/dashboard", {
      headers: { cookie: `sdk-contract-auth=${encoded}` },
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
    const refreshed = response.cookies.getAll().filter((cookie) => cookie.value);
    expect(refreshed.length).toBeGreaterThan(1);
    const next = await middleware(new NextRequest("https://ucat.local.test/dashboard", {
      headers: { cookie: refreshed.map(({ name, value }) => `${name}=${value}`).join("; ") },
    }));
    expect(next.status).toBe(200);
    expect(next.headers.get("x-middleware-request-x-altitutor-verified-user-id")).toBe(userId);
    expect(requests.filter((path) => path.endsWith("/token"))).toHaveLength(1);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: previous.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: previous.key, NEXT_PUBLIC_AUTH_COOKIE_NAME: previous.cookie })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
