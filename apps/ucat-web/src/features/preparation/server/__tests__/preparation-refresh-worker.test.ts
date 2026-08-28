import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { refreshStudentScoreProjection } from "@/features/preparation/server/score-projection-refresh";
import {
  reconcileStudyPlanAfterActivity,
  regenerateStudyPlanDuringScheduledMaintenance,
} from "@/features/study-plan/server/study-plan-service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureException } from "@sentry/nextjs";

jest.mock("server-only", () => ({}));
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock("@/features/preparation/server/score-projection-refresh", () => ({
  refreshStudentScoreProjection: jest.fn(),
}));
jest.mock("@/features/study-plan/server/study-plan-service", () => ({
  reconcileStudyPlanAfterActivity: jest.fn(),
  regenerateStudyPlanDuringScheduledMaintenance: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: jest.fn(), from: jest.fn() },
}));

describe("preparation refresh worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reconciles coalesced activity and rebalance reasons once and fences completion", async () => {
    jest.mocked(supabaseAdmin!.rpc).mockImplementation((name) => {
      if (name === "claim_ucat_preparation_refreshes") {
        return Promise.resolve({
          data: [
            {
              student_id: "student-1",
              requested_reasons: ["activity_completed", "scheduled_rebalance"],
              request_version: 42,
              claim_token: "claim-1",
            },
          ],
          error: null,
        }) as never;
      }
      return Promise.resolve({ data: true, error: null }) as never;
    });

    await expect(
      processPendingPreparationRefreshes({ limit: 1 }),
    ).resolves.toEqual({ claimed: 1, completed: 1, failed: 0 });

    expect(refreshStudentScoreProjection).toHaveBeenCalledWith("student-1");
    expect(reconcileStudyPlanAfterActivity).toHaveBeenCalledTimes(1);
    expect(regenerateStudyPlanDuringScheduledMaintenance).toHaveBeenCalledWith(
      "student-1",
      42,
    );
    expect(supabaseAdmin!.rpc).toHaveBeenLastCalledWith(
      "complete_ucat_preparation_refresh",
      {
        p_student_id: "student-1",
        p_claim_token: "claim-1",
        p_error: null,
      },
    );
  });

  it("records a structured stage-specific Supabase failure", async () => {
    jest.mocked(supabaseAdmin!.rpc).mockImplementation((name) => {
      if (name === "claim_ucat_preparation_refreshes") {
        return Promise.resolve({
          data: [
            {
              student_id: "student-1",
              requested_reasons: ["scheduled_rebalance"],
              request_version: 42,
              claim_token: "claim-1",
            },
          ],
          error: null,
        }) as never;
      }
      return Promise.resolve({ data: true, error: null }) as never;
    });
    jest.mocked(supabaseAdmin!.from).mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { dead_lettered_at: null }, error: null }),
        }),
      }),
    } as never);
    jest.mocked(refreshStudentScoreProjection).mockResolvedValue();
    jest.mocked(reconcileStudyPlanAfterActivity).mockResolvedValue();
    jest
      .mocked(regenerateStudyPlanDuringScheduledMaintenance)
      .mockRejectedValue({
        code: "PGRST100",
        message: "Bad Request",
        details: "Request URI is too long",
        hint: "Use a bounded server-side query",
      });

    await expect(
      processPendingPreparationRefreshes({ limit: 1 }),
    ).resolves.toEqual({ claimed: 1, completed: 0, failed: 1 });

    expect(supabaseAdmin!.rpc).toHaveBeenLastCalledWith(
      "complete_ucat_preparation_refresh",
      expect.objectContaining({
        p_error: JSON.stringify({
          stage: "study_plan_regeneration",
          message: "Bad Request",
          code: "PGRST100",
          details: "Request URI is too long",
          hint: "Use a bounded server-side query",
        }),
      }),
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bad Request" }),
      expect.objectContaining({
        tags: expect.objectContaining({
          stage: "study_plan_regeneration",
        }),
      }),
    );
  });
});
