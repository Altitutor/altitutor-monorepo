export type QuestionAttemptChartResult =
  | "correct"
  | "partial"
  | "incorrect"
  | "not_attempted";

export function getQuestionMaxPoints(
  questionType: "multiple_choice" | "syllogism" | null | undefined,
): number {
  return questionType === "syllogism" ? 2 : 1;
}

export function computeQuestionAttemptResult(params: {
  score: number | null;
  questionType: "multiple_choice" | "syllogism" | null | undefined;
  hasAttempt: boolean;
}): QuestionAttemptChartResult {
  const { score, questionType, hasAttempt } = params;
  if (!hasAttempt) return "not_attempted";
  if (score == null) return "not_attempted";

  const maxScore = getQuestionMaxPoints(questionType);
  if (score <= 0) return "incorrect";
  if (score >= maxScore) return "correct";
  return "partial";
}
