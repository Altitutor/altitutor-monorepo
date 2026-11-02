/** @jest-environment node */

import { NextRequest } from "next/server";
import { resolveUcatPortalAccess } from "@/features/auth/server/portal-access";
import { GET } from "../route";

jest.mock("server-only", () => ({}));
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
jest.mock("@/features/auth/server/portal-access", () => ({
  resolveUcatPortalAccess: jest.fn(),
}));

const mockResolveUcatPortalAccess = jest.mocked(resolveUcatPortalAccess);
const request = (query = "intent=login&next=%2Fdashboard") =>
  ({
    url: `https://ucat.altitutor.com/auth/continue?${query}`,
  }) as NextRequest;

describe("GET /auth/continue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("diverts authenticated active staff before Student onboarding", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({
      status: "allowed",
      userId: "staff-user",
      access: { activeStaffRole: "TUTOR", signupCompleted: null },
    } as never);

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.com/auth/staff-account",
    );
  });

  it("returns a retryable unavailable response when access cannot be checked", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({ status: "unavailable" });

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("continues incomplete Student signup using the caller-scoped result", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({
      status: "allowed",
      userId: "student-user",
      access: { activeStaffRole: null, signupCompleted: false },
    } as never);

    const response = await GET(request("intent=signup&next=%2Fstudy-plan"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.com/signup/complete?redirect=%2Fstudy-plan",
    );
  });

  it("redirects a missing session to login with return intent", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({
      status: "unauthenticated",
    });

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.com/login?redirect=%2Fdashboard",
    );
  });
});

describe("native continuation diagnostics", () => {
  const secret = "PRIVATE-ticket-state-challenge-cookie-identity";
  const next = `/mobile-auth?state=${secret}&challenge=${secret}&callback=${secret}`;
  let log: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  function nativeRequest(cookie = "") {
    return new NextRequest(
      `https://ucat.altitutor.com/auth/continue?intent=login&next=${encodeURIComponent(next)}`,
      { headers: { host: "ucat.altitutor.com", cookie } },
    );
  }

  it.each([
    ["allowed", "native-return", 307],
    ["unauthenticated", "login", 307],
    ["unavailable", "unavailable", 503],
  ] as const)("records bounded %s boundary without changing the response", async (status, destination, httpStatus) => {
    mockResolveUcatPortalAccess.mockResolvedValue({
      status,
      userId: secret,
      access: { activeStaffRole: null, signupCompleted: true },
    } as never);
    const name = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "student-auth";
    const response = await GET(nativeRequest(`${name}.0=${secret}; ${name}.1=${secret}; unrelated=${secret}`));

    expect(response.status).toBe(httpStatus);
    if (status === "allowed") {
      expect(response.headers.get("location")).toBe(`https://ucat.altitutor.com${next}`);
    } else if (status === "unauthenticated") {
      expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
      expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe(next);
    } else expect(response.headers.get("retry-after")).toBe("5");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[DEBUG-ucat-native-continue-v1]", {
      outcome: status,
      destination,
      auth_cookie_chunks: 2,
      request_host_matches_route: true,
      elapsed_ms: expect.any(Number),
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|state=|challenge=|callback=|student-auth|https?:/);
  });

  it("distinguishes an absent cookie and host change", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({ status: "unauthenticated" });
    const req = nativeRequest();
    req.headers.set("host", `other-${secret}.invalid`);
    await GET(req);
    expect(log.mock.calls[0]?.[1]).toMatchObject({ auth_cookie_chunks: 0, request_host_matches_route: false });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it("caps chunk counts and classifies onboarding without exposing a destination URL", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({
      status: "allowed", userId: secret,
      access: { activeStaffRole: null, signupCompleted: false },
    } as never);
    const name = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "student-auth";
    const response = await GET(nativeRequest(Array.from({ length: 12 }, (_, i) => `${name}.${i}=${secret}`).join("; ")));
    expect(response.status).toBe(307);
    expect(log.mock.calls[0]?.[1]).toMatchObject({ auth_cookie_chunks: 8, destination: "signup-complete" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it("keeps ordinary web continuations silent", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({ status: "unauthenticated" });
    await GET(request());
    expect(log).not.toHaveBeenCalled();
  });

  it("preserves the auth response if the diagnostic sink throws", async () => {
    mockResolveUcatPortalAccess.mockResolvedValue({ status: "unauthenticated" });
    log.mockImplementation(() => { throw new Error(secret); });
    const response = await GET(nativeRequest());
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
