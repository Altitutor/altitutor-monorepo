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
  new NextRequest(`https://student.altitutor.test${path}`, init);

describe("student session middleware", () => {
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
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(200);
    expect(
      response.headers.get(
        "x-middleware-request-x-altitutor-verified-user-id",
      ),
    ).toBe("student-1");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("redirects a missing protected session with return intent", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    const location = new URL((await middleware(request("/classes?week=next"))).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/classes?week=next");
  });

  it("redirects an anonymous root to marketing", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    expect((await middleware(request("/"))).headers.get("location")).toBe(
      "https://altitutor.com/online-learning/",
    );
  });

  it("treats invalid JWT verification as an instrumented outage", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthInvalidJwtError", code: "bad_jwt", message: "invalid" },
    });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Middleware dependency unavailable",
      expect.objectContaining({ tags: expect.objectContaining({ app: "student-web", supabase_error_code: "bad_jwt" }) }),
    );
  });

  it.each(["/login", "/api/classes", "/auth/callback?code=pkce"])(
    "skips session work for public path %s",
    async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the Supabase environment is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("preserves refreshed cookies and cache headers", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [{ name: "student-auth", value: "rotated", options: { path: "/", maxAge: 3600 } }],
        { Pragma: "no-cache" },
      );
      return { data: { claims: { sub: "student-1" } }, error: null };
    });
    const response = await middleware(request("/"));
    expect(response.headers.get("set-cookie")).toContain("student-auth=rotated");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
