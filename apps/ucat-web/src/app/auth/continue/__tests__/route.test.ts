/** @jest-environment node */

import type { NextRequest } from "next/server";
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
