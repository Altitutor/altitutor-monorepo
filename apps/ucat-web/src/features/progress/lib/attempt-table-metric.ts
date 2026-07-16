import { formatTimeSeconds } from "./format-time";
import { formatSpeedMultiplier } from "./format-speed-multiplier";

/** Graph metrics that map to a single per-attempt table column. */
export type AttemptTableMetric =
  | "scaled_score"
  | "percentage"
  | "time_taken"
  | "exam_speed"
  | "questions";

export type AttemptGraphDataType =
  | "scaled_score"
  | "percentage"
  | "time_taken"
  | "exam_speed"
  | "attempt_count"
  | "question_speed";

export type AttemptTableMetricScope = "set" | "mock" | "practice";

export function resolveAttemptTableMetric(
  graphDataType: AttemptGraphDataType,
  scope: AttemptTableMetricScope = "set",
): AttemptTableMetric {
  switch (graphDataType) {
    case "scaled_score":
      return scope === "practice" ? "percentage" : "scaled_score";
    case "percentage":
      return "percentage";
    case "time_taken":
      return "time_taken";
    case "exam_speed":
      return scope === "practice" ? "percentage" : "exam_speed";
    case "attempt_count":
      return scope === "practice" ? "questions" : "scaled_score";
    case "question_speed":
      return scope === "practice" ? "percentage" : "scaled_score";
    default: {
      const _exhaustive: never = graphDataType;
      return _exhaustive;
    }
  }
}

type MetricColumnConfig = {
  label: string;
  tooltip: string;
};

const SET_METRIC_COLUMNS: Record<AttemptTableMetric, MetricColumnConfig> = {
  scaled_score: {
    label: "Scaled score",
    tooltip:
      "Scaled score (300–900) normalised to UCAT exam scale for this section.",
  },
  percentage: {
    label: "Percentage",
    tooltip:
      "Points earned as a percentage of total possible points for this set.",
  },
  time_taken: {
    label: "Time taken",
    tooltip: "Time taken vs time limit for this set (e.g. 25:00 / 30:00).",
  },
  exam_speed: {
    label: "Exam speed",
    tooltip:
      "How fast you completed this set vs exam pace. 1x matches exam pace; above 1x is faster.",
  },
  questions: {
    label: "Questions",
    tooltip: "Number of questions in this attempt.",
  },
};

const MOCK_METRIC_COLUMNS: Record<AttemptTableMetric, MetricColumnConfig> = {
  scaled_score: {
    label: "Scaled score",
    tooltip:
      "Total UCAT mock score. Section 4 Situational Judgement excluded.",
  },
  percentage: {
    label: "Percentage",
    tooltip:
      "Points earned as a percentage of total possible points across all sets in this mock.",
  },
  time_taken: {
    label: "Time taken",
    tooltip: "Total time taken vs total time limit for all sets in this mock.",
  },
  exam_speed: {
    label: "Exam speed",
    tooltip:
      "Average speed across all sets. 1x matches exam pace; above 1x is faster.",
  },
  questions: {
    label: "Questions",
    tooltip: "Number of questions in this attempt.",
  },
};

const PRACTICE_METRIC_COLUMNS: Record<AttemptTableMetric, MetricColumnConfig> =
  {
    scaled_score: {
      label: "Scaled score",
      tooltip: "Not available for practice sessions.",
    },
    percentage: {
      label: "Percentage",
      tooltip:
        "Points earned as a percentage of total possible points in this practice session.",
    },
    time_taken: {
      label: "Time taken",
      tooltip: "Total time spent in this practice session.",
    },
    exam_speed: {
      label: "Exam speed",
      tooltip: "Not available for practice sessions.",
    },
    questions: {
      label: "Questions",
      tooltip: "Number of questions in this practice session.",
    },
  };

export function getAttemptTableMetricColumn(
  metric: AttemptTableMetric,
  scope: AttemptTableMetricScope,
): MetricColumnConfig {
  switch (scope) {
    case "mock":
      return MOCK_METRIC_COLUMNS[metric];
    case "practice":
      return PRACTICE_METRIC_COLUMNS[metric];
    case "set":
      return SET_METRIC_COLUMNS[metric];
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
}

type AttemptMetricValues = {
  scaledScore?: number | null;
  scaledScoreMax?: number | null;
  scorePoints: number | null;
  totalPoints: number | null;
  timeTakenSeconds: number | null;
  setTimeLimitSeconds?: number | null;
  studentExamSpeed?: number | null;
  questionCount?: number | null;
};

export function formatAttemptTableMetricValue(
  metric: AttemptTableMetric,
  attempt: AttemptMetricValues,
  scope: AttemptTableMetricScope,
): string {
  switch (metric) {
    case "scaled_score": {
      if (attempt.scaledScore == null) return "—";
      if (scope === "mock" && attempt.scaledScoreMax != null) {
        return `${Math.round(attempt.scaledScore)} / ${attempt.scaledScoreMax}`;
      }
      return String(Math.round(attempt.scaledScore));
    }
    case "percentage": {
      const total = attempt.totalPoints ?? 0;
      const points = attempt.scorePoints ?? 0;
      if (total <= 0) return "—";
      return `${Math.round((points / total) * 100)}%`;
    }
    case "time_taken": {
      const timeLimit = attempt.setTimeLimitSeconds ?? 0;
      const timeTaken = attempt.timeTakenSeconds;
      if (timeTaken == null) return "—";
      if (scope !== "practice" && timeLimit > 0) {
        return `${formatTimeSeconds(Math.round(timeTaken))} / ${formatTimeSeconds(Math.round(timeLimit))}`;
      }
      return formatTimeSeconds(Math.round(timeTaken));
    }
    case "exam_speed": {
      return formatSpeedMultiplier(attempt.studentExamSpeed);
    }
    case "questions": {
      return attempt.questionCount != null ? String(attempt.questionCount) : "—";
    }
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}
