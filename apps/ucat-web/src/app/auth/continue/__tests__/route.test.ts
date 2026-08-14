/** @jest-environment node */

import type { NextRequest } from "next/server";
import { GET } from "../route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);
const mockedAdminFrom = jest.mocked(supabaseAdmin!.from);

describe("GET /auth/continue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "staff-user", user_metadata: {} } },
        })),
      },
    } as never);
  });

  it("diverts authenticated active staff before Student onboarding", async () => {
    mockedAdminFrom.mockImplementation((relation: string) => {
      if (relation === "staff") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({
                  data: { role: "TUTOR" },
                  error: null,
                })),
              })),
            })),
          })),
        } as never;
      }
      throw new Error(`Unexpected relation: ${relation}`);
    });

    const response = await GET({
      url: "https://ucat.altitutor.com/auth/continue?intent=login&next=%2Fdashboard",
    } as NextRequest);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ucat.altitutor.com/auth/staff-account",
    );
  });

  it("fails closed when staff eligibility cannot be checked", async () => {
    mockedAdminFrom.mockImplementation((relation: string) => {
      if (relation === "staff") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({
                  data: null,
                  error: { message: "database unavailable" },
                })),
              })),
            })),
          })),
        } as never;
      }
      throw new Error(`Unexpected relation: ${relation}`);
    });

    await expect(
      GET({
        url: "https://ucat.altitutor.com/auth/continue?intent=login&next=%2Fdashboard",
      } as NextRequest),
    ).rejects.toThrow("Staff eligibility lookup failed");
  });
});
