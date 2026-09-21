export type QuestionAttemptChartResult =
  | "correct"
  | "partial"
  | "incorrect"
  | "not_attempted";

export function computeQuestionAttemptResult(params: {
  score: number | null;
  maximumPoints: number;
  hasAttempt: boolean;
}): QuestionAttemptChartResult {
  const { score, maximumPoints, hasAttempt } = params;
  if (!hasAttempt) return "not_attempted";
  if (score == null) return "not_attempted";

  if (score <= 0) return "incorrect";
  if (score >= maximumPoints) return "correct";
  return "partial";
}
