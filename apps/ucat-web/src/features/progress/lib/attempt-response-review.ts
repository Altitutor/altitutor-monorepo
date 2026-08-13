import type { ReviewContract } from "@altitutor/ucat-response-contract";
import { evaluatePersistedQuestionResponse } from "@/features/question-engine/lib/response-state";
import type { QuestionItem } from "@/features/question-engine/model/types";

export type StoredQuestionAttemptResponse = {
  score?: number | null;
  questionAnswerOptionId?: string | null;
  answerSnapshot?: unknown;
};

export function projectStoredQuestionAttemptReview(
  question: QuestionItem,
  attempt: StoredQuestionAttemptResponse | undefined,
): { points: number; review: ReviewContract } | null {
  if (!attempt) return null;

  const evaluation = evaluatePersistedQuestionResponse(
    question,
    attempt.answerSnapshot,
    attempt.questionAnswerOptionId,
  );

  return {
    points: attempt.score ?? evaluation.score.awarded,
    review: evaluation.review,
  };
}
