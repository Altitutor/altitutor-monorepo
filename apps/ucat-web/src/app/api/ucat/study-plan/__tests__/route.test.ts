import { GET } from "@/app/api/ucat/study-plan/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStudyPlan } from "@/features/study-plan/server/study-plan-service";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/features/study-plan/server/study-plan-service", () => ({
  getStudyPlan: jest.fn(),
  saveStudyPlanProfile: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockGetStudyPlan = jest.mocked(getStudyPlan);

describe("GET /api/ucat/study-plan", () => {
  it.each(["", "?view=dashboard"])(
    "is read-only for ordinary and dashboard reads (%s)",
    async (search) => {
      const plan = {
        profile: null,
        generation: null,
        tasks: [],
        nextSteps: [],
        today: "2026-08-25",
        todayTasks: [],
        completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
      };
      mockGetSupabaseServerClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
          }),
        },
      } as never);
      mockGetStudyPlan.mockResolvedValue(plan);

      const response = await GET({
        nextUrl: new URL(`https://ucat.test/api/ucat/study-plan${search}`),
      } as never);

      expect(response.status).toBe(200);
      expect(mockGetStudyPlan).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        {
          allowAutomaticReplan: false,
          reconcileTasks: false,
          refreshGuidance: false,
        },
      );
    },
  );
});
