/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pickStems } from "@/features/practice/server/pick-stems";
import { getPracticeQuotaStatusForStudent } from "@/lib/ucat/quota/quota-service";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock("@/features/practice/server/pick-stems", () => ({
  pickStems: jest.fn(),
}));
jest.mock("@/lib/ucat/quota/quota-service", () => ({
  getPracticeQuotaStatusForStudent: jest.fn(),
  quotaExceededResponse: jest.fn(),
}));

const mockedServerClient = jest.mocked(getSupabaseServerClient);
const mockedPickStems = jest.mocked(pickStems);
const mockedQuotaStatus = jest.mocked(getPracticeQuotaStatusForStudent);

describe("POST /api/ucat/practice-stems/next", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("commits the server-prefetched snapshot without rebuilding the stem", async () => {
    const prefetchedStem = {
      id: "stem-2",
      questionSetId: "practice",
      sectionName: "Verbal Reasoning",
      sectionDisplayColumns: 1 as const,
      stemText: "Stem",
      stemJson: null,
      questions: [],
    };
    const readerFrom = jest.fn(() => {
      throw new Error("delivery should not query question content again");
    });
    mockedServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: readerFrom,
    } as never);

    const update = jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(async () => ({ error: null })),
      })),
    }));
    const adminFrom = jest.mocked(supabaseAdmin!.from);
    adminFrom.mockImplementation((relation: string) => {
      if (relation === "students") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: { id: "student-1" },
                error: null,
              })),
            })),
          })),
        } as never;
      }
      if (relation === "student_practice_sessions") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({
                  data: {
                    id: "session-1",
                    stems_snapshot: [],
                    prefetched_stem_snapshot: prefetchedStem,
                    unlimited: true,
                    completed_at: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
          update,
        } as never;
      }
      throw new Error(`Unexpected relation: ${relation}`);
    });
    mockedQuotaStatus.mockResolvedValue({
      isQuotaExempt: true,
      limit: null,
      remaining: null,
    } as never);

    const response = await POST({
      json: async () => ({
        input: {
          section: "verbal_reasoning",
          categoryIds: [],
          unansweredOnly: false,
          incorrectOnly: false,
          timeMode: "off",
          timeSpeedMultiplier: 1,
          customTimeMinutes: null,
          questionCount: 1,
        },
        excludeStemIds: ["stem-1"],
        practiceSessionId: "session-1",
        deliverStemId: "stem-2",
      }),
    } as unknown as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ stem: prefetchedStem });
    expect(update).toHaveBeenCalledWith({
      stems_snapshot: [prefetchedStem],
      prefetched_stem_snapshot: null,
    });
    expect(mockedPickStems).not.toHaveBeenCalled();
    expect(readerFrom).not.toHaveBeenCalled();
  });
});
