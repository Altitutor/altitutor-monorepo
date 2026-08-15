/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);
const mockedAdminFrom = jest.mocked(supabaseAdmin!.from);
let insertedStudent: Record<string, unknown> | null;

describe("POST /api/ucat/signup/complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedStudent = null;
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: {
            user: {
              id: "staff-user-1",
              email: "tutor@example.com",
            },
          },
          error: null,
        })),
      },
    } as never);

    mockedAdminFrom.mockImplementation((relation: string) => {
      if (relation !== "students") {
        throw new Error(`Unexpected relation: ${relation}`);
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => {
              return { data: null, error: null };
            }),
          })),
          ilike: jest.fn(() => ({
            maybeSingle: jest.fn(async () => {
              return { data: null, error: null };
            }),
          })),
        })),
        insert: jest.fn(async (payload: Record<string, unknown>) => {
          insertedStudent = payload;
          return {
            data: null,
            error: { message: "User has an active staff record" },
          };
        }),
      } as never;
    });
  });

  it("explains that an active staff account cannot become a student account", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await POST({
        json: async () => ({
          firstName: "Tutor",
          lastName: "Tester",
        }),
      } as unknown as NextRequest);

      expect(response.status).toBe(400);
      expect(insertedStudent).toEqual(
        expect.objectContaining({ status: null }),
      );
      await expect(response.json()).resolves.toEqual({
        error:
          "This email is already linked to an Altitutor staff account. Please use a different email address for your student account.",
      });
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
