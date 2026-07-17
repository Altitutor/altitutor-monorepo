import type {
  CohortPercentileAggregate,
  CohortPercentileResult,
  ScoreBin,
} from "./types";

export const MINIMUM_PERCENTILE_COHORT_SIZE = 20;

function clampDisplayedPercentile(percentile: number): number {
  return Math.min(99, Math.max(1, Math.round(percentile)));
}

export function calculateMidrankPercentile({
  cohortSize,
  scoresBelow,
  scoresEqual,
}: Pick<
  CohortPercentileAggregate,
  "cohortSize" | "scoresBelow" | "scoresEqual"
>): number | null {
  if (cohortSize <= 0 || scoresBelow < 0 || scoresEqual <= 0) return null;

  return clampDisplayedPercentile(
    (100 * (scoresBelow + scoresEqual / 2)) / cohortSize,
  );
}

export function calculatePercentileFromBins(
  score: number,
  bins: ScoreBin[],
): number | null {
  const cohortSize = bins.reduce((total, bin) => total + bin.count, 0);
  if (cohortSize <= 0) return null;

  let scoresBelow = 0;
  let scoresEqual = 0;
  for (const bin of bins) {
    if (bin.score < score) scoresBelow += bin.count;
    if (bin.score === score) scoresEqual += bin.count;
  }

  const rawPercentile =
    (100 * (scoresBelow + scoresEqual / 2)) / cohortSize;
  return clampDisplayedPercentile(rawPercentile);
}

export function resolveCohortPercentile(
  aggregate: CohortPercentileAggregate | null | undefined,
  minimumCohortSize = MINIMUM_PERCENTILE_COHORT_SIZE,
): CohortPercentileResult {
  const base = {
    cohortSize: aggregate?.cohortSize ?? 0,
    minimumCohortSize,
    targetScore: aggregate?.targetScore ?? null,
    bins: aggregate?.bins ?? [],
  };

  if (aggregate?.targetScore == null) {
    return { ...base, status: "unavailable" };
  }

  if (aggregate.cohortSize < minimumCohortSize) {
    return { ...base, status: "insufficient_data" };
  }

  const percentile = calculateMidrankPercentile(aggregate);
  if (percentile == null) {
    return { ...base, status: "unavailable" };
  }

  return {
    ...base,
    status: "available",
    percentile,
    targetScore: aggregate.targetScore,
  };
}
