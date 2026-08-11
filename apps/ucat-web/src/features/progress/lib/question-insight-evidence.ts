import type { ReviewContract } from "@altitutor/ucat-response-contract";
import type { QuestionItem } from "@/features/question-engine/model/types";

export function getWrongAnswerExplanations(
  question: QuestionItem,
  review: ReviewContract | undefined,
): string[] {
  if (!review) return [];
  const optionIds =
    review.kind === "single_select"
      ? [review.selectedOptionId]
      : review.rows
          .filter((row) => row.outcome === "incorrect")
          .map((row) => row.targetId);
  const explanationByOptionId = new Map(
    question.options.map((option) => [
      option.id,
      option.answerExplanation?.trim(),
    ]),
  );
  return optionIds
    .map((optionId) =>
      optionId ? explanationByOptionId.get(optionId) : undefined,
    )
    .filter((explanation): explanation is string => Boolean(explanation));
}
