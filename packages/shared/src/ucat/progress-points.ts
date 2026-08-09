import {
  getAnswerSchemeMaximum,
  type AnswerScheme,
} from "@altitutor/ucat-response-contract";

export type ProgressQuestionRef = {
  id: string;
  stemId: string;
  questionType: string | null;
  answerScheme: AnswerScheme["kind"] | null;
};

/**
 * Maximum progress points for a set of questions, aligned with UCAT raw-score
 * weighting: each question contributes the maximum marks declared by its answer scheme
 * once regardless of how many conclusion statements it contains.
 */
export function computeQuestionProgressPoints(
  questions: ProgressQuestionRef[],
): number {
  let points = 0;
  for (const question of questions) {
    points += progressPointsForQuestion(question, new Set());
  }
  return points;
}

/**
 * Progress points contributed by one question when building a running total.
 * Pass the same `countedSyllogismStems` set across calls to avoid double-counting
 * legacy callers may still supply their former de-duplication set; answer schemes
 * now remain the sole authority for progress weighting.
 */
export function progressPointsForQuestion(
  question: ProgressQuestionRef,
  countedSyllogismStems: Set<string>,
): number {
  void countedSyllogismStems;
  return question.answerScheme
    ? getAnswerSchemeMaximum(question.answerScheme)
    : 1;
}

export function toProgressQuestionRef(question: {
  questionId: string;
  questionStemId?: string | null;
  questionType?: string | null;
  answerScheme?: AnswerScheme["kind"] | null;
}): ProgressQuestionRef {
  return {
    id: question.questionId,
    stemId: question.questionStemId ?? question.questionId,
    questionType: question.questionType ?? null,
    answerScheme: question.answerScheme ?? null,
  };
}
