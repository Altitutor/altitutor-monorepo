/** @jest-environment node */

import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn(), instrumentSupabaseClient: jest.fn() }));

const mockCreateServerClient = jest.mocked(createServerClient);
const mockCaptureMessage = jest.mocked(Sentry.captureMessage);
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://ucat.altitutor.test${path}`, init);

describe("UCAT session middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "student-1" } }, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
      rpc: mockRpc,
    } as never);
  });

  it("does no database work for protected navigation", async () => {
    expect((await middleware(request("/dashboard"))).status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("redirects an anonymous protected request with return intent", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    const location = new URL((await middleware(request("/practice?mode=timed"))).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/practice?mode=timed");
  });

  it("redirects anonymous subscribe traffic to signup", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    const location = new URL((await middleware(request("/subscribe?plan=unlimited"))).headers.get("location")!);
    expect(location.pathname).toBe("/signup");
    expect(location.searchParams.get("redirect")).toBe("/subscribe?plan=unlimited");
  });

  it("allows authenticated public entry pages to resolve access server-side", async () => {
    expect((await middleware(request("/login"))).status).toBe(200);
    expect(mockGetClaims).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns an instrumented 503 for a claims dependency failure", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthUnknownError", code: "upstream" } });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Middleware dependency unavailable",
      expect.objectContaining({ tags: expect.objectContaining({ app: "ucat-web", supabase_error_code: "upstream" }) }),
    );
  });

  it.each(["/auth/callback?code=pkce", "/api/auth/session", "/api/ucat/profile"])(
    "skips session work for no-session path %s",
    async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("preserves refreshed cookies and Supabase response headers", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [{ name: "student-auth", value: "rotated", options: { path: "/", httpOnly: true } }],
        { Expires: "0" },
      );
      return { data: { claims: { sub: "student-1" } }, error: null };
    });
    const response = await middleware(request("/dashboard"));
    expect(response.headers.get("set-cookie")).toContain("student-auth=rotated");
    expect(response.headers.get("expires")).toBe("0");
  });
});
