import "server-only";

import { captureException } from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshStudentScoreProjection } from "@/features/preparation/server/score-projection-refresh";
import {
  regenerateStudyPlanDuringScheduledMaintenance,
  reconcileStudyPlanAfterActivity,
} from "@/features/study-plan/server/study-plan-service";

type RefreshRequest = {
  student_id: string;
  requested_reasons: string[];
};

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase admin client is unavailable.");
  return supabaseAdmin;
}

async function completeRequest(
  studentId: string,
  error: string | null,
): Promise<void> {
  const admin = requireAdmin() as unknown as {
    rpc: (
      name: "complete_ucat_preparation_refresh",
      params: { p_student_id: string; p_error: string | null },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const result = await admin.rpc("complete_ucat_preparation_refresh", {
    p_student_id: studentId,
    p_error: error,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function processPendingPreparationRefreshes(
  options: { studentId?: string; limit?: number } = {},
): Promise<{ claimed: number; completed: number; failed: number }> {
  const admin = requireAdmin() as unknown as {
    rpc: (
      name: "claim_ucat_preparation_refreshes",
      params: { p_limit: number; p_student_id: string | null },
    ) => Promise<{
      data: RefreshRequest[] | null;
      error: { message: string } | null;
    }>;
  };
  const claim = await admin.rpc("claim_ucat_preparation_refreshes", {
    p_limit: Math.max(1, Math.min(options.limit ?? 5, 50)),
    p_student_id: options.studentId ?? null,
  });
  if (claim.error) throw new Error(claim.error.message);
  const requests = claim.data ?? [];
  let completed = 0;
  let failed = 0;

  for (const request of requests) {
    try {
      await refreshStudentScoreProjection(request.student_id);
      if (request.requested_reasons.includes("activity_completed")) {
        await reconcileStudyPlanAfterActivity(request.student_id);
      }
      if (request.requested_reasons.includes("scheduled_rebalance")) {
        await reconcileStudyPlanAfterActivity(request.student_id);
        await regenerateStudyPlanDuringScheduledMaintenance(
          request.student_id,
        );
      }
      await completeRequest(request.student_id, null);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      captureException(error, {
        tags: { subsystem: "ucat_preparation_refresh" },
        extra: {
          studentId: request.student_id,
          reasons: request.requested_reasons,
        },
      });
      await completeRequest(request.student_id, message);
      failed += 1;
    }
  }

  return { claimed: requests.length, completed, failed };
}
