/** @jest-environment node */

import * as Sentry from "@sentry/nextjs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveUcatPortalAccess } from "../portal-access";

jest.mock("server-only", () => ({}));
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockCaptureMessage = jest.mocked(Sentry.captureMessage);
const mockGetClaims = jest.fn();
const mockRpc = jest.fn();

const accessPayload = {
  student_id: "student-1",
  active_staff_role: null,
  has_online_access: true,
  has_in_person_access: false,
  has_ucat_access: true,
  online_tier: "UNLIMITED",
  is_quota_exempt: false,
  ucat_onboarding_completed_at: "2026-08-01T00:00:00Z",
  ucat_signup_completed_at: "2026-08-01T00:00:00Z",
  ucat_signup_step: 4,
  unlimited_trial_eligible: false,
  ucat_analytics_account_class: "external",
  ucat_test_year: 2027,
  ucat_test_date: "2027-07-01",
};

describe("resolveUcatPortalAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-26T00:00:00Z"));
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getClaims: mockGetClaims },
      rpc: mockRpc,
    } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries one clock-skew rejection and records recovery", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST303", message: "JWT issued at future" },
      })
      .mockResolvedValueOnce({ data: accessPayload, error: null });

    const pending = resolveUcatPortalAccess();
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toMatchObject({
      status: "allowed",
      userId: "user-1",
      access: { studentId: "student-1", hasUcatAccess: true },
    });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Portal access JWT clock skew recovered",
      expect.objectContaining({
        tags: expect.objectContaining({ retry_outcome: "recovered" }),
      }),
    );
  });

  it("does not retry unrelated database failures", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    await expect(resolveUcatPortalAccess()).resolves.toEqual({
      status: "unavailable",
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Portal access dependency unavailable",
      expect.objectContaining({
        tags: expect.objectContaining({
          dependency_stage: "portal_access",
          supabase_error_code: "57014",
        }),
      }),
    );
  });

  it("treats only a missing session as unauthenticated", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError" },
    });

    await expect(resolveUcatPortalAccess()).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("uses middleware-verified identity without verifying the JWT twice", async () => {
    mockGetClaims.mockRejectedValue(new Error("redundant auth verification"));
    mockRpc.mockResolvedValue({ data: accessPayload, error: null });

    await expect(resolveUcatPortalAccess("user-1")).resolves.toMatchObject({
      status: "allowed",
      userId: "user-1",
      access: { studentId: "student-1" },
    });
    expect(mockGetClaims).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("reports other claims failures as unavailable", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthUnknownError", code: "upstream" },
    });

    await expect(resolveUcatPortalAccess()).resolves.toEqual({
      status: "unavailable",
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Portal access dependency unavailable",
      expect.objectContaining({
        tags: expect.objectContaining({
          dependency_stage: "authentication",
          supabase_error_code: "upstream",
        }),
      }),
    );
  });
});
