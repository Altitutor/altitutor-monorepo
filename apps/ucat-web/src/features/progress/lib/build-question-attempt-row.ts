import { computeQuestionAttemptResult } from "./compute-question-attempt-result";
import {
  resolveAttemptScore,
  type SyllogismOption,
} from "./syllogism-attempt-scoring";

type AttemptData = {
  score: number | null;
  questionType: "multiple_choice" | "syllogism" | null;
  answerSnapshot?: Record<string, boolean> | null;
};

export function resolveQuestionAttemptScoreAndResult(params: {
  questionId: string;
  attemptData: AttemptData | undefined;
  syllogismOptionsByQuestionId: Map<string, SyllogismOption[]>;
}): {
  score: number | null;
  result: ReturnType<typeof computeQuestionAttemptResult>;
} {
  const { questionId, attemptData, syllogismOptionsByQuestionId } = params;

  if (attemptData == null) {
    return { score: null, result: "not_attempted" };
  }

  const score = resolveAttemptScore({
    dbScore: attemptData.score,
    questionType: attemptData.questionType,
    answerSnapshot: attemptData.answerSnapshot,
    syllogismOptions: syllogismOptionsByQuestionId.get(questionId),
  });

  const result = computeQuestionAttemptResult({
    score,
    questionType: attemptData.questionType,
    hasAttempt: true,
  });

  return { score, result };
}
