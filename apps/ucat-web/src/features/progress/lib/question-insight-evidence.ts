import type { ReviewContract } from "@altitutor/ucat-response-contract";
import {
  isPlacementResponse,
  placementPresentationForQuestion,
} from "@/features/question-engine/lib/response-state";
import type {
  AnswerOption,
  QuestionItem,
} from "@/features/question-engine/model/types";

function isMissedPlacementRow(
  row: Extract<ReviewContract, { kind: "placement" }>["rows"][number],
): boolean {
  if (row.outcome === "incorrect") return true;
  return row.outcome === "unanswered" && row.correctToken != null;
}

export type WrongAnswerInsightItem =
  | {
      kind: "single_select";
      option: AnswerOption;
      letter: string;
    }
  | {
      kind: "placement";
      option: AnswerOption;
      chosenTokenLabel: string | null;
    };

function optionHasExplanation(option: AnswerOption): boolean {
  return Boolean(
    option.answerExplanation?.trim() || option.answerExplanationJson,
  );
}

function optionLetter(question: QuestionItem, optionId: string): string {
  const ordered = [...question.options].sort(
    (left, right) => left.index - right.index,
  );
  const index = ordered.findIndex((option) => option.id === optionId);
  return String.fromCharCode(65 + Math.max(0, index));
}

export function getWrongAnswerInsightItems(
  question: QuestionItem,
  review: ReviewContract | undefined,
): WrongAnswerInsightItem[] {
  if (!review) return [];

  if (review.kind === "single_select") {
    if (review.outcome === "correct" || review.outcome === "unanswered") {
      return [];
    }
    const option = question.options.find(
      (item) => item.id === review.selectedOptionId,
    );
    if (!option || !optionHasExplanation(option)) return [];
    return [
      {
        kind: "single_select",
        option,
        letter: optionLetter(question, option.id),
      },
    ];
  }

  if (!isPlacementResponse(question)) return [];

  const presentation = placementPresentationForQuestion(question);
  const tokenLabel = new Map(
    presentation.tokens.map((token) => [token.value, token.label]),
  );

  return review.rows.flatMap((row) => {
    if (!isMissedPlacementRow(row)) return [];
    const option = question.options.find((item) => item.id === row.targetId);
    if (!option || !optionHasExplanation(option)) return [];
    return [
      {
        kind: "placement" as const,
        option,
        chosenTokenLabel: row.placedToken
          ? (tokenLabel.get(row.placedToken) ?? row.placedToken)
          : null,
      },
    ];
  });
}
