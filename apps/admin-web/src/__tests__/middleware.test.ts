/** @jest-environment node */

import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  instrumentSupabaseClient: jest.fn(),
}));

const mockCreateServerClient = jest.mocked(createServerClient);
const mockCaptureMessage = jest.mocked(Sentry.captureMessage);
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://admin.altitutor.test${path}`, init);

describe("admin session middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClaims.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } }, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
      rpc: mockRpc,
    } as never);
  });

  it.each(["/login", "/forgot-password", "/api/staff"])(
    "does not contact Supabase for public path %s",
    async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("verifies only the session for protected routes", async () => {
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(200);
    expect(
      response.headers.get(
        "x-middleware-request-x-altitutor-verified-user-id",
      ),
    ).toBe("admin-1");
    expect(mockGetClaims).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("redirects the authenticated root without a database lookup", async () => {
    const response = await middleware(request("/"));
    expect(response.headers.get("location")).toBe("https://admin.altitutor.test/dashboard");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("redirects a missing session to login", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError", message: "missing" },
    });
    expect((await middleware(request("/dashboard"))).headers.get("location")).toBe(
      "https://admin.altitutor.test/login",
    );
  });

  it("clears a dead refresh-token session and redirects to login", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [{ name: "admin-auth", value: "", options: { path: "/", maxAge: 0 } }],
        { Pragma: "no-cache" },
      );
      return {
        data: null,
        error: {
          name: "AuthApiError",
          code: "refresh_token_not_found",
          message: "Invalid Refresh Token: Refresh Token Not Found",
        },
      };
    });

    const response = await middleware(request("/dashboard"));

    expect(response.headers.get("location")).toBe(
      "https://admin.altitutor.test/login",
    );
    expect(response.headers.get("set-cookie")).toContain("admin-auth=");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(mockCaptureMessage).not.toHaveBeenCalledWith(
      "Middleware dependency unavailable",
      expect.anything(),
    );
  });

  it("retries once when claims verification reports JWT clock skew", async () => {
    jest.useFakeTimers();
    mockGetClaims
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: "AuthInvalidJwtError",
          code: "bad_jwt",
          message: "JWT issued at future",
        },
      })
      .mockResolvedValueOnce({
        data: { claims: { sub: "admin-1" } },
        error: null,
      });
    try {
      const pending = middleware(request("/dashboard"));
      await jest.advanceTimersByTimeAsync(1_000);
      const response = await pending;

      expect(response.status).toBe(200);
      expect(mockGetClaims).toHaveBeenCalledTimes(2);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "Middleware JWT clock skew recovered",
        expect.objectContaining({
          tags: expect.objectContaining({
            app: "admin-web",
            retry_outcome: "recovered",
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns an instrumented 503 for any other claims failure", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthInvalidJwtError", code: "bad_jwt", message: "invalid" },
    });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Middleware dependency unavailable",
      expect.objectContaining({
        tags: expect.objectContaining({
          app: "admin-web",
          dependency_stage: "authentication",
          supabase_error_code: "bad_jwt",
        }),
      }),
    );
  });

  it("preserves refreshed cookies and Supabase response headers", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [{ name: "admin-auth", value: "rotated", options: { path: "/", maxAge: 3600 } }],
        { Pragma: "no-cache" },
      );
      return { data: { claims: { sub: "admin-1" } }, error: null };
    });
    const response = await middleware(request("/"));
    expect(response.headers.get("set-cookie")).toContain("admin-auth=rotated");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("bounds the session dependency to ten seconds", async () => {
    jest.useFakeTimers();
    mockGetClaims.mockReturnValue(new Promise(() => undefined));
    try {
      const pending = middleware(request("/dashboard"));
      jest.advanceTimersByTime(10_000);
      expect((await pending).status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });
});
