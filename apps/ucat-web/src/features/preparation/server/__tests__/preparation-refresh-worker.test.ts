import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { refreshStudentScoreProjection } from "@/features/preparation/server/score-projection-refresh";
import {
  reconcileStudyPlanAfterActivity,
  regenerateStudyPlanDuringScheduledMaintenance,
} from "@/features/study-plan/server/study-plan-service";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
});
