/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureUcatSignupCompletedInBackground } from "@/lib/analytics/posthog-server";
import { PATCH } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureUcatSignupCompletedInBackground: jest.fn(),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);
const mockedAdminFrom = jest.mocked(supabaseAdmin!.from);
const mockedCaptureSignup = jest.mocked(
  captureUcatSignupCompletedInBackground,
);
const relationshipUpsert = jest.fn();
const attributionInsert = jest.fn();
const attributionUpdateEq = jest.fn();
const attributionUpdate = jest.fn(() => ({ eq: attributionUpdateEq }));

const existingAttribution = {
  id: "attribution-1",
  first_touch_captured_at: "2026-08-01T00:00:00.000Z",
  first_utm_source: "reddit",
  first_utm_medium: "social",
  first_utm_campaign: "launch",
  first_utm_content: null,
  first_utm_term: null,
  first_referrer_domain: "reddit.com",
  first_landing_path: "/ucat",
  self_reported_sources: ["reddit", "friend_or_classmate"],
  self_reported_other: null,
};

let attributionRow: typeof existingAttribution | null;

describe("PATCH /api/ucat/signup/progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    attributionRow = existingAttribution;
    relationshipUpsert.mockResolvedValue({ error: null });
    attributionInsert.mockResolvedValue({ error: null });
    attributionUpdateEq.mockResolvedValue({ error: null });
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: {
            user: {
              id: "student-user-1",
              user_metadata: { profile_setup_complete: true },
            },
          },
          error: null,
        })),
      },
    } as never);

    mockedAdminFrom.mockImplementation((relation: string) => {
      if (relation === "students") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: {
                  id: "student-1",
                  ucat_signup_step: 4,
                  ucat_signup_completed_at: null,
                  ucat_onboarding_completed_at: null,
                  account_class: "external",
                  first_name: "Online",
                  last_name: "Student",
                },
                error: null,
              })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(async () => ({ error: null })),
          })),
        } as never;
      }

      if (relation === "student_online_product_relationships") {
        return { upsert: relationshipUpsert } as never;
      }

      if (relation === "student_product_acquisition_attributions") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({
                  data: attributionRow,
                  error: null,
                })),
              })),
            })),
          })),
          insert: attributionInsert,
          update: attributionUpdate,
        } as never;
      }

      throw new Error(`Unexpected relation: ${relation}`);
    });
  });

  it("establishes the UCATWeb relationship when signup completes", async () => {
    const response = await PATCH({
      json: async () => ({ complete: true }),
    } as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(relationshipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "student-1",
        product: "UCAT_WEB",
        closed_at: null,
        started_at: expect.any(String),
      }),
      { onConflict: "student_id,product", ignoreDuplicates: true },
    );
    expect(mockedCaptureSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student-user-1",
        studentId: "student-1",
        selfReportedSources: ["reddit", "friend_or_classmate"],
        observedFirstTouch: expect.objectContaining({
          utmSource: "reddit",
          landingPath: "/ucat",
        }),
      }),
    );
  });

  it("requires acquisition attribution before advancing past its step", async () => {
    attributionRow = null;

    const response = await PATCH({
      json: async () => ({ complete: true }),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(relationshipUpsert).not.toHaveBeenCalled();
  });

  it("stores multiple self-reported sources and observed first touch", async () => {
    attributionRow = null;
    const observedFirstTouch = {
      utmSource: "tiktok",
      utmMedium: "social",
      utmCampaign: "founder-launch",
      utmContent: null,
      utmTerm: null,
      referrerDomain: "tiktok.com",
      landingPath: "/ucat",
      capturedAt: "2026-08-31T00:00:00.000Z",
    };

    const response = await PATCH({
      json: async () => ({
        step: 4,
        acquisitionSources: ["tiktok", "friend_or_classmate"],
        observedFirstTouch,
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(attributionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "student-1",
        product: "UCAT_WEB",
        self_reported_sources: ["tiktok", "friend_or_classmate"],
        first_utm_source: "tiktok",
        first_landing_path: "/ucat",
      }),
    );
  });

  it("rejects not sure when combined with another source", async () => {
    const response = await PATCH({
      json: async () => ({
        step: 4,
        acquisitionSources: ["not_sure", "reddit"],
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(attributionInsert).not.toHaveBeenCalled();
  });
});
