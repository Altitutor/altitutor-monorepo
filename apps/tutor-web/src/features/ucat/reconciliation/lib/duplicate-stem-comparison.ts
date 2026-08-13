import type { Json } from "@altitutor/shared";
import { proseMirrorToPlainText } from "@/features/ucat/shared/lib/rich-text";
import { normalizeSimilarityText } from "@/features/ucat/questions/lib/stem-similarity";

type ComparableOption = {
  answer_text?: unknown;
  answer_explanation?: unknown;
  index?: number;
  answer_key_value?: string | null;
};

type ComparableQuestion = {
  question_text: unknown;
  answer_explanation?: unknown;
  index: number;
  response_type?: string | null;
  answer_scheme?: string | null;
  answer_options?: ComparableOption[];
};

function normalizedRichText(value: unknown): string {
  return normalizeSimilarityText(proseMirrorToPlainText(value as Json) ?? "");
}

function canonicalQuestion(question: ComparableQuestion) {
  return {
    questionText: normalizedRichText(question.question_text),
    answerExplanation: normalizedRichText(question.answer_explanation),
    responseType: question.response_type ?? null,
    answerScheme: question.answer_scheme ?? null,
    options: [...(question.answer_options ?? [])]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((option) => ({
        answerText: normalizedRichText(option.answer_text),
        answerExplanation: normalizedRichText(option.answer_explanation),
        answerKeyValue: option.answer_key_value ?? null,
      })),
  };
}

export function hasExactDuplicateContent(
  leftStemText: unknown,
  leftQuestions: ComparableQuestion[],
  rightStemText: unknown,
  rightQuestions: ComparableQuestion[],
): boolean {
  if (normalizedRichText(leftStemText) !== normalizedRichText(rightStemText))
    return false;

  const left = [...leftQuestions]
    .sort((a, b) => a.index - b.index)
    .map(canonicalQuestion);
  const right = [...rightQuestions]
    .sort((a, b) => a.index - b.index)
    .map(canonicalQuestion);
  return JSON.stringify(left) === JSON.stringify(right);
}

export type SuggestedMergeDirection = "A-into-B" | "B-into-A";

export function suggestMergeDirection(
  leftStemText: unknown,
  rightStemText: unknown,
): SuggestedMergeDirection {
  const leftLength = normalizedRichText(leftStemText).length;
  const rightLength = normalizedRichText(rightStemText).length;

  // The stem with more source-specific material becomes the source. Its unique
  // blocks are moved into its questions while the cleaner stem remains shared.
  return leftLength > rightLength ? "A-into-B" : "B-into-A";
}
