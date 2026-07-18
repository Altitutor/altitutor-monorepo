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

  it("commits a prefetched stem despite unrelated session activity", async () => {
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

    const updateBuilder = {
      eq: jest.fn(),
      is: jest.fn(),
      select: jest.fn(),
      maybeSingle: jest.fn(async () => ({
        data: { id: "session-1" },
        error: null,
      })),
    };
    updateBuilder.eq.mockReturnValue(updateBuilder);
    updateBuilder.is.mockReturnValue(updateBuilder);
    updateBuilder.select.mockReturnValue(updateBuilder);
    const update = jest.fn(() => updateBuilder);
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
                    discarded_at: null,
                    expired_at: null,
                    last_activity_at: "2026-07-18T14:00:00.000Z",
                    stem_delivery_revision: 7,
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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        stems_snapshot: [prefetchedStem],
        prefetched_stem_snapshot: null,
        last_activity_at: expect.any(String),
        stem_delivery_revision: 8,
      }),
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith(
      "stem_delivery_revision",
      7,
    );
    expect(updateBuilder.eq).not.toHaveBeenCalledWith(
      "last_activity_at",
      expect.anything(),
    );
    expect(updateBuilder.eq).not.toHaveBeenCalledWith(
      "stems_snapshot",
      expect.anything(),
    );
    expect(updateBuilder.eq).not.toHaveBeenCalledWith(
      "prefetched_stem_snapshot",
      expect.anything(),
    );
    expect(mockedPickStems).not.toHaveBeenCalled();
    expect(readerFrom).not.toHaveBeenCalled();
  });
});
