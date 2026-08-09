import {
  extractTextFromRichJson,
  mapRichExplanation,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type {
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionItem,
} from "@/features/question-engine/model/types";
import type { AttemptReviewQuestionTag } from "./attempt-review-question-metadata";
import type { SyllogismOption } from "./syllogism-attempt-scoring";

type SnapshotOption = {
  id: string;
  index: number;
  answerText: unknown;
  answerExplanation?: unknown;
  isAnswer: boolean;
  answerKeyValue?: QuestionItem["options"][number]["answerKeyValue"];
};

export type UcatAttemptContentSnapshot = {
  schemaVersion: number;
  stem: {
    id: string;
    sectionId?: string | null;
    sectionNumber?: number | null;
    sectionName?: string | null;
    sectionDisplayColumns?: number | null;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryDescription?: unknown;
    stemText: unknown;
  };
  question: {
    id: string;
    questionText: unknown;
    answerExplanation?: unknown;
    index: number;
    difficulty?: number | null;
    timeBurdenSeconds?: number | null;
    questionType: "multiple_choice" | "syllogism";
    responseType?: QuestionItem["responseType"];
    answerScheme?: QuestionItem["answerScheme"];
    tags?: Array<{ id?: string; name?: string; description?: unknown }>;
  };
  answerOptions: SnapshotOption[];
};

export function parseAttemptContentSnapshot(
  value: unknown,
): UcatAttemptContentSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<UcatAttemptContentSnapshot>;
  if (!snapshot.stem?.id || !snapshot.question?.id) return null;
  if (
    snapshot.question.questionType !== "multiple_choice" &&
    snapshot.question.questionType !== "syllogism"
  ) {
    return null;
  }
  return {
    ...snapshot,
    schemaVersion: snapshot.schemaVersion ?? 1,
    stem: snapshot.stem,
    question: snapshot.question,
    answerOptions: Array.isArray(snapshot.answerOptions)
      ? snapshot.answerOptions
      : [],
  };
}

export function snapshotQuestionMetadata(snapshot: UcatAttemptContentSnapshot) {
  const questionTags: AttemptReviewQuestionTag[] = (snapshot.question.tags ?? [])
    .filter((tag) => Boolean(tag.name))
    .map((tag) => ({
      name: tag.name as string,
      description: tag.description
        ? extractTextFromRichJson(tag.description as JsonLike) || null
        : null,
    }));
  return {
    difficulty: snapshot.question.difficulty ?? null,
    timeBurdenSeconds: snapshot.question.timeBurdenSeconds ?? null,
    questionTags,
    categoryName: snapshot.stem.categoryName ?? null,
    categoryDescription: snapshot.stem.categoryDescription
      ? extractTextFromRichJson(snapshot.stem.categoryDescription as JsonLike) || null
      : null,
    questionStemCategoryId: snapshot.stem.categoryId ?? null,
  };
}

export function snapshotSyllogismOptions(
  snapshot: UcatAttemptContentSnapshot,
): SyllogismOption[] {
  if (snapshot.question.questionType !== "syllogism") return [];
  return snapshot.answerOptions.map((option) => ({
    id: option.id,
    index: option.index,
    isAnswer: option.isAnswer,
  }));
}

export function snapshotToQuestionItem(
  snapshot: UcatAttemptContentSnapshot,
  index: number,
  questionSetId: string,
): QuestionItem {
  const options = [...snapshot.answerOptions]
    .sort((a, b) => a.index - b.index)
    .map((option) => {
      const explanation = mapRichExplanation(option.answerExplanation);
      return {
        id: option.id,
        index: option.index,
        text: extractTextFromRichJson(option.answerText as JsonLike),
        textJson:
          option.answerText && typeof option.answerText === "object"
            ? (option.answerText as Record<string, unknown>)
            : null,
        isAnswer: option.isAnswer,
        answerKeyValue: option.answerKeyValue ?? null,
        answerExplanation: explanation.text,
        answerExplanationJson: explanation.json,
      };
    });
  const questionExplanation = mapRichExplanation(
    snapshot.question.answerExplanation,
  );
  return {
    id: snapshot.question.id,
    index,
    questionSetId,
    stemId: snapshot.stem.id,
    sectionName: snapshot.stem.sectionName ?? "UCAT",
    sectionDisplayColumns:
      snapshot.stem.sectionDisplayColumns === 2 ? 2 : 1,
    stemText: extractTextFromRichJson(snapshot.stem.stemText as JsonLike),
    stemJson:
      snapshot.stem.stemText && typeof snapshot.stem.stemText === "object"
        ? (snapshot.stem.stemText as Record<string, unknown>)
        : null,
    questionText: extractTextFromRichJson(
      snapshot.question.questionText as JsonLike,
    ),
    questionJson:
      snapshot.question.questionText &&
      typeof snapshot.question.questionText === "object"
        ? (snapshot.question.questionText as Record<string, unknown>)
        : null,
    questionType: snapshot.question.questionType,
    responseType: snapshot.question.responseType,
    answerScheme: snapshot.question.answerScheme,
    options,
    correctOptionId: options.find((option) => option.isAnswer)?.id,
    answerExplanation: questionExplanation.text,
    answerExplanationJson: questionExplanation.json,
  };
}

export function buildAttemptReviewExam(args: {
  sourceType: Extract<QuestionEngineMode, "set" | "mock">;
  sourceId: string;
  title: string;
  snapshots: Array<{ snapshot: UcatAttemptContentSnapshot; questionSetId: string }>;
}): QuestionEngineExam {
  return {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    title: args.title,
    questions: args.snapshots.map(({ snapshot, questionSetId }, index) =>
      snapshotToQuestionItem(snapshot, index, questionSetId),
    ),
    instructionsScreens: [],
  };
}
