import type { PlacementSnapshot, QuestionItem, ReviewFilter } from "@/features/question-engine/model/types";
import {
  evaluatePersistedQuestionResponse,
  snapshotQuestionResponse,
} from "@/features/question-engine/lib/response-state";

export type ReviewQuestionStatus = "unseen" | "incomplete" | "complete";

export function getReviewQuestionStatus(
  question: QuestionItem,
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  placementSnapshots?: Record<string, PlacementSnapshot>,
): ReviewQuestionStatus {
  const evaluation = evaluatePersistedQuestionResponse(
    question,
    snapshotQuestionResponse(
      question,
      selectedAnswers[question.id],
      placementSnapshots?.[question.id],
    ),
  );
  if (evaluation.complete) return "complete";

  const visited = visitedQuestionIds.includes(question.id);
  return visited ? "incomplete" : "unseen";
}

/**
 * Returns indices into questions array that match the given filter when in review mode.
 */
export function getReviewFilterIndices(
  questions: QuestionItem[],
  filter: ReviewFilter,
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  flaggedIds: string[],
  placementSnapshots?: Record<string, PlacementSnapshot>,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const status = getReviewQuestionStatus(
      q,
      visitedQuestionIds,
      selectedAnswers,
      placementSnapshots,
    );
    const flagged = flaggedIds.includes(q.id);
    if (filter === "all") {
      indices.push(i);
    } else if (filter === "incomplete") {
      if (status === "unseen" || status === "incomplete") indices.push(i);
    } else {
      if (flagged) indices.push(i);
    }
  }
  return indices;
}

export function getIncompleteCount(
  questions: QuestionItem[],
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  placementSnapshots?: Record<string, PlacementSnapshot>,
): number {
  return questions.filter(
    (q) =>
      getReviewQuestionStatus(
        q,
        visitedQuestionIds,
        selectedAnswers,
        placementSnapshots,
      ) !== "complete",
  ).length;
}
