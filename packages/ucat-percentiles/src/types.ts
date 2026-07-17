export type ScoreBin = {
  score: number;
  count: number;
};

export type CohortPercentileAggregate = {
  targetScore: number | null;
  cohortSize: number;
  scoresBelow: number;
  scoresEqual: number;
  bins: ScoreBin[];
};

type CohortPercentileBase = {
  cohortSize: number;
  minimumCohortSize: number;
  targetScore: number | null;
  bins: ScoreBin[];
};

export type CohortPercentileResult =
  | (CohortPercentileBase & {
      status: "available";
      percentile: number;
      targetScore: number;
    })
  | (CohortPercentileBase & {
      status: "insufficient_data";
    })
  | (CohortPercentileBase & {
      status: "unavailable";
    });

export type UcatAnzBenchmarkResult = {
  year: 2025;
  candidateCount: number;
  score: number | null;
  status: "available" | "below_published_range" | "above_published_range" | "unavailable";
  percentile: number | null;
  percentileLabel: string | null;
};
