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

const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://tutor.altitutor.test${path}`, init);

describe("tutor session middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "tutor-1" } }, error: null });
    mockCreateServerClient.mockReturnValue({ auth: { getClaims: mockGetClaims }, from: mockFrom } as never);
  });

  it("does no database work for a protected route", async () => {
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(200);
    expect(
      response.headers.get(
        "x-middleware-request-x-altitutor-verified-user-id",
      ),
    ).toBe("tutor-1");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("preserves return intent for a missing session", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    const location = new URL((await middleware(request("/classes?week=next"))).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/classes?week=next");
  });

  it("redirects the authenticated root to dashboard", async () => {
    expect((await middleware(request("/"))).headers.get("location")).toBe(
      "https://tutor.altitutor.test/dashboard",
    );
  });

  it("returns an instrumented 503 for non-missing claims errors", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthUnknownError", code: "upstream" } });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Middleware dependency unavailable",
      expect.objectContaining({ tags: expect.objectContaining({ app: "tutor-web", supabase_error_code: "upstream" }) }),
    );
  });

  it.each(["/login", "/api/calendar", "/pdfjs/pdf.min.mjs"])(
    "skips session work for public path %s",
    async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("preserves refreshed cookie metadata", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [{ name: "tutor-auth", value: "rotated", options: { path: "/", httpOnly: true } }],
        { Expires: "0" },
      );
      return { data: { claims: { sub: "tutor-1" } }, error: null };
    });
    const response = await middleware(request("/"));
    expect(response.headers.get("set-cookie")).toContain("tutor-auth=rotated");
    expect(response.headers.get("expires")).toBe("0");
  });
});
