/** @jest-environment node */

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { middleware } from "../middleware";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));

const mockCreateServerClient = jest.mocked(createServerClient);
const mockGetClaims = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
let consoleError: jest.SpyInstance;

function request(
  pathname: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`https://tutor.altitutor.test${pathname}`, init);
}

describe("tutor routing middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "tutor-1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "TUTOR", status: "ACTIVE" },
      error: null,
    });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
    } as never);
    consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it("allows an active tutor through to a protected page", async () => {
    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows an active admin through to a protected page", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { role: "ADMINSTAFF", status: "ACTIVE" },
      error: null,
    });
    expect((await middleware(request("/dashboard"))).status).toBe(200);
  });

  it("redirects an anonymous protected request with return intent", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError", message: "missing" },
    });
    const response = await middleware(request("/classes?week=next"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/classes?week=next");
  });

  it("redirects an anonymous root request to login", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError", message: "missing" },
    });

    const response = await middleware(request("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://tutor.altitutor.test/login?next=%2F",
    );
  });

  it("denies an inactive or missing staff profile", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { role: "TUTOR", status: "INACTIVE" },
      error: null,
    });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("access_denied");
  });

  it.each([
    [
      "authentication",
      () => mockGetClaims.mockReturnValue(new Promise(() => undefined)),
    ],
    [
      "profile",
      () => mockMaybeSingle.mockReturnValue(new Promise(() => undefined)),
    ],
  ])("bounds a stalled %s dependency to ten seconds", async (_name, stall) => {
    jest.useFakeTimers();
    stall();
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

  it("returns 503 for a profile lookup error", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "upstream unavailable" },
    });
    const response = await middleware(request("/dashboard"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["/login", "/api/calendar", "/pdfjs/pdf.min.mjs"])(
    "does not contact Supabase for public path %s",
    async (pathname) => {
      expect((await middleware(request(pathname))).status).toBe(200);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    },
  );

  it("does not authenticate CORS preflight requests", async () => {
    const response = await middleware(request("/", { method: "OPTIONS" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("preserves refreshed cookies on redirects", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [
          {
            name: "tutor-auth",
            value: "rotated",
            options: { path: "/", httpOnly: true, maxAge: 3_600 },
          },
        ],
        {},
      );
      return { data: { claims: { sub: "tutor-1" } }, error: null };
    });
    const response = await middleware(request("/"));
    expect(response.headers.get("location")).toBe(
      "https://tutor.altitutor.test/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=3600");
  });
});
