import type { QuestionAttemptChartResult } from "./compute-question-attempt-result";

/** Bar colours aligned with attempt review points (green / amber / red). */
export const ATTEMPT_CHART_RESULT_COLORS: Record<
  QuestionAttemptChartResult,
  string
> = {
  correct: "hsl(142 76% 36%)",
  partial: "hsl(32 95% 44%)",
  incorrect: "hsl(0 84% 60%)",
  not_attempted: "hsl(var(--muted-foreground) / 0.3)",
};

export const ATTEMPT_CHART_RESULT_LABELS: Record<
  QuestionAttemptChartResult,
  string
> = {
  correct: "Correct",
  partial: "Partial",
  incorrect: "Incorrect",
  not_attempted: "Not attempted",
};
