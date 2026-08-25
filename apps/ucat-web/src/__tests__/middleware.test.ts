/** @jest-environment node */

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { middleware } from "../middleware";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

const mockCreateServerClient = jest.mocked(createServerClient);
const mockGetClaims = jest.fn();
const mockAccessMaybeSingle = jest.fn();
const mockAccessSelect = jest.fn(() => ({
  maybeSingle: mockAccessMaybeSingle,
}));
const mockFrom = jest.fn(() => ({ select: mockAccessSelect }));
const mockRpc = jest.fn();
let consoleError: jest.SpyInstance;

function request(
  pathname: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`https://ucat.altitutor.test${pathname}`, init);
}

describe("UCAT routing middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "student-1" } },
      error: null,
    });
    mockAccessMaybeSingle.mockResolvedValue({
      data: { ucat_signup_completed_at: "2026-08-19T00:00:00Z" },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
      rpc: mockRpc,
    } as never);
    consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("allows a completed authenticated student through to a protected page", async () => {
    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns a retryable response when authentication is unavailable", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthUnknownError", message: "upstream unavailable" },
    });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(consoleError).toHaveBeenCalled();
  });

  it("fails closed when the Supabase environment is unavailable", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("bounds the entire middleware invocation to ten seconds", async () => {
    jest.useFakeTimers();
    mockGetClaims.mockReturnValue(new Promise(() => undefined));

    try {
      const responsePromise = middleware(request("/dashboard"));
      jest.advanceTimersByTime(10_000);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("5");
    } finally {
      jest.useRealTimers();
    }
  });

  it("applies the same deadline to the account access lookups", async () => {
    jest.useFakeTimers();
    mockAccessMaybeSingle.mockReturnValue(new Promise(() => undefined));

    try {
      const responsePromise = middleware(request("/dashboard"));
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("5");
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns a retryable response when signup access is unavailable", async () => {
    mockAccessMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "upstream unavailable" },
    });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("returns a retryable response when staff access is unavailable", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "upstream unavailable" },
    });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("redirects an anonymous protected request to login with return intent", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: {
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      },
    });

    const response = await middleware(request("/dashboard?source=email"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe(
      "/dashboard?source=email",
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("redirects an anonymous root request to login", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: {
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      },
    });

    const response = await middleware(request("/"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("redirects an incomplete student to signup completion with return intent", async () => {
    mockAccessMaybeSingle.mockResolvedValue({
      data: { ucat_signup_completed_at: null },
      error: null,
    });

    const response = await middleware(request("/dashboard?source=email"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/signup/complete");
    expect(location.searchParams.get("redirect")).toBe(
      "/dashboard?source=email",
    );
  });

  it("redirects an active staff identity away from the student app", async () => {
    mockRpc.mockResolvedValue({ data: "ADMINSTAFF", error: null });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.test/auth/staff-account",
    );
  });

  it("does not run page access lookups for an authenticated API request", async () => {
    const response = await middleware(request("/api/ucat/profile"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    "/auth/callback?code=pkce",
    "/api/auth/session",
    "/api/cron/ucat-preparation-refreshes",
  ])(
    "does not contact Supabase for no-auth path %s",
    async (pathname) => {
      const response = await middleware(request(pathname));

      expect(response.status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("does not authenticate CORS preflight requests", async () => {
    const response = await middleware(request("/", { method: "OPTIONS" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("preserves refreshed session cookies on a routing redirect", async () => {
    mockGetClaims.mockImplementation(async () => {
      const options = mockCreateServerClient.mock.calls[0]?.[2];
      options?.cookies?.setAll?.(
        [
          {
            name: "student-auth",
            value: "rotated-session",
            options: { path: "/", httpOnly: true, maxAge: 3_600 },
          },
        ],
        {},
      );
      return {
        data: { claims: { sub: "student-1" } },
        error: null,
      };
    });

    const response = await middleware(request("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.test/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "student-auth=rotated-session",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=3600");
  });
});
