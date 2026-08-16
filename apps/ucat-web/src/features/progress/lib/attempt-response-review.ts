import type { ReviewContract } from "@altitutor/ucat-response-contract";
import { evaluatePersistedQuestionResponse } from "@/features/question-engine/lib/response-state";
import type { QuestionItem } from "@/features/question-engine/model/types";

export type StoredQuestionAttemptResponse = {
  score?: number | null;
  selectedOptionId?: string | null;
  answerSnapshot?: unknown;
};

export function selectedOptionIdFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const response = (snapshot as { response?: unknown }).response;
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const selectedOptionId = (response as { selectedOptionId?: unknown })
    .selectedOptionId;
  return typeof selectedOptionId === "string" ? selectedOptionId : null;
}

export function projectStoredQuestionAttemptReview(
  question: QuestionItem,
  attempt: StoredQuestionAttemptResponse | undefined,
): { points: number; review: ReviewContract } | null {
  if (!attempt) return null;

  const evaluation = evaluatePersistedQuestionResponse(
    question,
    attempt.answerSnapshot,
  );

  return {
    points: attempt.score ?? evaluation.score.awarded,
    review: evaluation.review,
  };
}
