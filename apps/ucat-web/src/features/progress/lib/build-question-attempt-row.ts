import { computeQuestionAttemptResult } from "./compute-question-attempt-result";
type AttemptData = {
  score: number | null;
};

export function resolveQuestionAttemptScoreAndResult(params: {
  attemptData: AttemptData | undefined;
  maximumPoints: number;
}): {
  score: number | null;
  result: ReturnType<typeof computeQuestionAttemptResult>;
} {
  const { attemptData, maximumPoints } = params;

  if (attemptData == null) {
    return { score: null, result: "not_attempted" };
  }

  const score = attemptData.score;

  const result = computeQuestionAttemptResult({
    score,
    maximumPoints,
    hasAttempt: true,
  });

  return { score, result };
}
