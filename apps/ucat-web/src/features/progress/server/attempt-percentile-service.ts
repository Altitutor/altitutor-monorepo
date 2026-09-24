import "server-only";

import {
  resolveCohortPercentile,
  type CohortPercentileAggregate,
  type CohortPercentileResult,
  type ScoreBin,
} from "@altitutor/ucat-percentiles";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AttemptPercentileScope = "set" | "mock";

function parseScoreBins(value: unknown): ScoreBin[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") return [];
    const score = Number((entry as { score?: unknown }).score);
    const count = Number((entry as { count?: unknown }).count);
    if (!Number.isFinite(score) || !Number.isInteger(count) || count <= 0) {
      return [];
    }
    return [{ score, count }];
  });
}

export async function getAttemptPercentile(
  scope: AttemptPercentileScope,
  attemptId: string,
): Promise<CohortPercentileResult> {
  if (!supabaseAdmin) return resolveCohortPercentile(null);

  const query =
    scope === "set"
      ? supabaseAdmin.rpc("get_ucat_set_attempt_percentile_cohort", {
          p_attempt_id: attemptId,
        })
      : supabaseAdmin.rpc("get_ucat_mock_attempt_percentile_cohort", {
          p_attempt_id: attemptId,
        });
  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Could not load ${scope} attempt percentile cohort`, error);
    return resolveCohortPercentile(null);
  }

  if (!data) return resolveCohortPercentile(null);

  const aggregate: CohortPercentileAggregate = {
    targetScore: Number(data.target_score),
    cohortSize: Number(data.cohort_size),
    scoresBelow: Number(data.scores_below),
    scoresEqual: Number(data.scores_equal),
    bins: parseScoreBins(data.bins),
  };
  return resolveCohortPercentile(aggregate);
}
