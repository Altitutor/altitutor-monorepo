import { formatPercentile } from "./format";
import type { UcatAnzBenchmarkResult } from "./types";

export const UCAT_ANZ_BENCHMARK_YEAR = 2025 as const;
export const UCAT_ANZ_2025_CANDIDATE_COUNT = 16_950;

const TOTAL_COGNITIVE_DECILES_2025 = [
  { score: 1610, percentile: 10 },
  { score: 1710, percentile: 20 },
  { score: 1780, percentile: 30 },
  { score: 1850, percentile: 40 },
  { score: 1930, percentile: 50 },
  { score: 2000, percentile: 60 },
  { score: 2090, percentile: 70 },
  { score: 2190, percentile: 80 },
  { score: 2310, percentile: 90 },
] as const;

export function lookupUcatAnzTotalPercentile(
  score: number | null | undefined,
): UcatAnzBenchmarkResult {
  const base = {
    year: UCAT_ANZ_BENCHMARK_YEAR,
    candidateCount: UCAT_ANZ_2025_CANDIDATE_COUNT,
    score: score == null ? null : Math.round(score),
  };

  if (score == null || !Number.isFinite(score)) {
    return {
      ...base,
      status: "unavailable",
      percentile: null,
      percentileLabel: null,
    };
  }

  const first = TOTAL_COGNITIVE_DECILES_2025[0];
  const last = TOTAL_COGNITIVE_DECILES_2025[TOTAL_COGNITIVE_DECILES_2025.length - 1];
  if (score < first.score) {
    return {
      ...base,
      status: "below_published_range",
      percentile: null,
      percentileLabel: "Below 10th percentile",
    };
  }
  if (score > last.score) {
    return {
      ...base,
      status: "above_published_range",
      percentile: null,
      percentileLabel: "Above 90th percentile",
    };
  }

  for (let index = 1; index < TOTAL_COGNITIVE_DECILES_2025.length; index += 1) {
    const lower = TOTAL_COGNITIVE_DECILES_2025[index - 1];
    const upper = TOTAL_COGNITIVE_DECILES_2025[index];
    if (score <= upper.score) {
      const position = (score - lower.score) / (upper.score - lower.score);
      const percentile = Math.round(
        lower.percentile + position * (upper.percentile - lower.percentile),
      );
      return {
        ...base,
        status: "available",
        percentile,
        percentileLabel: formatPercentile(percentile),
      };
    }
  }

  return {
    ...base,
    status: "available",
    percentile: last.percentile,
    percentileLabel: formatPercentile(last.percentile),
  };
}
