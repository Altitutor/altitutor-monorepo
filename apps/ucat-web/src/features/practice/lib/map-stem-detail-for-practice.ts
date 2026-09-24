import {
  extractTextFromRichJson,
  mapRichExplanation,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type {
  AnswerOption,
  QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";

export type StemDetailQuestionFromDb = {
  id: string;
  question_text: unknown;
  answer_explanation?: unknown;
  index: number;
  response_type: QuestionStemWithQuestions["questions"][number]["responseType"];
  answer_scheme: QuestionStemWithQuestions["questions"][number]["answerScheme"];
  answer_options?: Array<{
    id: string;
    answer_text: unknown;
    answer_explanation?: unknown;
    index: number;
    answer_key_value?: AnswerOption["answerKeyValue"];
    selection_count?: number;
    total_answered?: number;
    percentage?: number;
  }>;
};

export type StemDetailRowFromDb = {
  id: string;
  section_name: string;
  display_columns: number | null;
  stem_text: unknown;
  questions: StemDetailQuestionFromDb[] | null;
};

function richJsonField(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value != null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

export function mapStemDetailToQuestionStemWithQuestions(
  row: StemDetailRowFromDb,
  questionSetId = "practice",
): QuestionStemWithQuestions {
  const questions = (row.questions ?? []).map((q) => {
    const options: AnswerOption[] = (q.answer_options ?? [])
      .map((opt) => {
        const optionExplanation = mapRichExplanation(opt.answer_explanation);

        return {
          id: opt.id,
          index: opt.index,
          text: extractTextFromRichJson(opt.answer_text as JsonLike),
          textJson: richJsonField(opt.answer_text),
          answerKeyValue: opt.answer_key_value ?? null,
          answerExplanation: optionExplanation.text,
          answerExplanationJson: optionExplanation.json,
          selectionCount: opt.selection_count,
          totalAnswered: opt.total_answered,
          percentage: opt.percentage,
        };
      })
      .sort((a, b) => a.index - b.index);

    const questionExplanation = mapRichExplanation(q.answer_explanation);

    return {
      id: q.id,
      index: q.index,
      questionText: extractTextFromRichJson(q.question_text as JsonLike),
      questionJson: richJsonField(q.question_text),
      responseType: q.response_type,
      answerScheme: q.answer_scheme,
      options,
      answerExplanation: questionExplanation.text,
      answerExplanationJson: questionExplanation.json,
    };
  });

  return {
    id: row.id,
    questionSetId,
    sectionName: row.section_name ?? "",
    sectionDisplayColumns: (row.display_columns ?? 1) === 2 ? 2 : 1,
    stemText: extractTextFromRichJson(row.stem_text as JsonLike),
    stemJson: richJsonField(row.stem_text),
    questions: questions.sort((a, b) => a.index - b.index),
  };
}
