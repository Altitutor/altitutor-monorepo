import {
  getAnswerSchemeProgressPoints,
  type AnswerScheme,
} from "@altitutor/ucat-response-contract";

export type ProgressQuestionRef = {
  id: string;
  stemId: string;
  questionType: string | null;
  answerScheme: AnswerScheme["kind"] | null;
};

/**
 * Progress points for a set of questions. The Answer scheme owns each question's
 * weight; grouped Decision Making rows contribute two points once per stem.
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
 * Pass the same `countedGroupedQuestionIds` set across calls to avoid counting a
 * grouped Answer scheme more than once.
 */
export function progressPointsForQuestion(
  question: ProgressQuestionRef,
  countedGroupedQuestionIds: Set<string>,
): number {
  if (!question.answerScheme) return 1;
  if (question.answerScheme === "decision_making_binary_placement") {
    if (countedGroupedQuestionIds.has(question.stemId)) return 0;
    countedGroupedQuestionIds.add(question.stemId);
  }
  return getAnswerSchemeProgressPoints(question.answerScheme);
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
