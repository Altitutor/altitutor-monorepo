/** @jest-environment node */

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

import { middleware } from "../middleware";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));

const mockCreateServerClient = jest.mocked(createServerClient);
const mockGetClaims = jest.fn();
const mockStudentMaybeSingle = jest.fn();
const mockStaffMaybeSingle = jest.fn();
const mockStudentSelect = jest.fn(() => ({
  maybeSingle: mockStudentMaybeSingle,
}));
const mockStaffSelect = jest.fn(() => ({ maybeSingle: mockStaffMaybeSingle }));
const mockFrom = jest.fn((relation: string) => {
  if (relation === "vstudent_profile") return { select: mockStudentSelect };
  if (relation === "vtutor_profile") return { select: mockStaffSelect };
  throw new Error(`Unexpected relation: ${relation}`);
});
let consoleError: jest.SpyInstance;

function request(
  pathname: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`https://student.altitutor.test${pathname}`, init);
}

describe("student routing middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.altitutor.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL = "https://admin.altitutor.test";
    process.env.NEXT_PUBLIC_TUTOR_PORTAL_URL = "https://tutor.altitutor.test";
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "student-1" } },
      error: null,
    });
    mockStudentMaybeSingle.mockResolvedValue({
      data: { id: "student-1" },
      error: null,
    });
    mockStaffMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
    } as never);
    consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("allows an authenticated student through to a protected page", async () => {
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
  });

  it("bounds a stalled authentication dependency to ten seconds", async () => {
    jest.useFakeTimers();
    mockGetClaims.mockReturnValue(new Promise(() => undefined));
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
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("treats an invalid JWT as unauthenticated instead of an outage", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthInvalidJwtError", message: "invalid signature" },
    });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=");
  });

  it.each(["/login", "/api/classes", "/auth/callback?code=pkce"])(
    "does not contact Supabase for public path %s",
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

  it("redirects an active admin to admin-web", async () => {
    mockStaffMaybeSingle.mockResolvedValue({
      data: { role: "ADMINSTAFF", status: "ACTIVE" },
      error: null,
    });

    const response = await middleware(request("/dashboard"));

    expect(response.headers.get("location")).toBe(
      "https://admin.altitutor.test/admin/dashboard",
    );
  });

  it("redirects an active tutor to tutor-web", async () => {
    mockStaffMaybeSingle.mockResolvedValue({
      data: { role: "TUTOR", status: "ACTIVE" },
      error: null,
    });

    const response = await middleware(request("/dashboard"));

    expect(response.headers.get("location")).toBe(
      "https://tutor.altitutor.test/dashboard",
    );
  });

  it("denies an authenticated identity without a student or active staff profile", async () => {
    mockStudentMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://student.altitutor.test/login?error=access_denied",
    );
  });

  it("returns a retryable response when an access lookup fails", async () => {
    mockStudentMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "upstream unavailable" },
    });

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("applies the invocation deadline to the concurrent access lookups", async () => {
    jest.useFakeTimers();
    mockStudentMaybeSingle.mockReturnValue(new Promise(() => undefined));

    try {
      const responsePromise = middleware(request("/dashboard"));
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);

      const response = await responsePromise;
      expect(response.status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });

  it("preserves refreshed cookie options on redirects", async () => {
    mockGetClaims.mockImplementation(async () => {
      mockCreateServerClient.mock.calls[0]?.[2]?.cookies?.setAll?.(
        [
          {
            name: "student-auth",
            value: "rotated-session",
            options: { path: "/", httpOnly: true, maxAge: 3_600 },
          },
        ],
        {},
      );
      return { data: { claims: { sub: "student-1" } }, error: null };
    });

    const response = await middleware(request("/"));

    expect(response.headers.get("location")).toBe(
      "https://student.altitutor.test/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "student-auth=rotated-session",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=3600");
  });

  it("fails closed when the Supabase environment is unavailable", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});
