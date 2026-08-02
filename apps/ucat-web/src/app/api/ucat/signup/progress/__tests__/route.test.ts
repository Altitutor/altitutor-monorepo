/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PATCH } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);
const mockedAdminFrom = jest.mocked(supabaseAdmin!.from);
const relationshipUpsert = jest.fn();

describe("PATCH /api/ucat/signup/progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    relationshipUpsert.mockResolvedValue({ error: null });
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
  });
});
