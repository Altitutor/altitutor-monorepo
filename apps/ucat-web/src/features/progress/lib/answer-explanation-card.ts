import { isPlacementResponse } from "@/features/question-engine/lib/response-state";
import type { QuestionItem } from "@/features/question-engine/model/types";

export type AnswerExplanationCardModel =
  | { kind: "empty" }
  | { kind: "question" }
  | { kind: "options"; optionIds: string[] };

function hasExplanation(item: {
  answerExplanation?: string;
  answerExplanationJson?: Record<string, unknown> | null;
}): boolean {
  return Boolean(item.answerExplanation || item.answerExplanationJson);
}

export function getAnswerExplanationCardModel(
  question: QuestionItem,
): AnswerExplanationCardModel {
  if (isPlacementResponse(question)) {
    const optionIds = question.options
      .filter(hasExplanation)
      .map((option) => option.id);
    return optionIds.length > 0
      ? { kind: "options", optionIds }
      : { kind: "empty" };
  }

  return hasExplanation(question) ? { kind: "question" } : { kind: "empty" };
}

export function shouldShowQuestionExplanationInInsight(
  question: QuestionItem,
  result: "correct" | "partial" | "incorrect" | "not_attempted" | undefined,
): boolean {
  return (
    isPlacementResponse(question) &&
    result !== "correct" &&
    hasExplanation(question)
  );
}
