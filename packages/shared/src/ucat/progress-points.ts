export type ProgressQuestionRef = {
  id: string;
  stemId: string;
  questionType: string | null;
};

/**
 * Maximum progress points for a set of questions, aligned with UCAT raw-score
 * weighting: each non-syllogism question counts 1; each syllogism stem counts 2
 * once regardless of how many conclusion statements it contains.
 */
export function computeQuestionProgressPoints(
  questions: ProgressQuestionRef[],
): number {
  const countedSyllogismStems = new Set<string>();
  let points = 0;
  for (const question of questions) {
    points += progressPointsForQuestion(question, countedSyllogismStems);
  }
  return points;
}

/**
 * Progress points contributed by one question when building a running total.
 * Pass the same `countedSyllogismStems` set across calls to avoid double-counting
 * syllogism stems.
 */
export function progressPointsForQuestion(
  question: ProgressQuestionRef,
  countedSyllogismStems: Set<string>,
): number {
  if (question.questionType === "syllogism") {
    if (countedSyllogismStems.has(question.stemId)) {
      return 0;
    }
    countedSyllogismStems.add(question.stemId);
    return 2;
  }
  return 1;
}

export function toProgressQuestionRef(question: {
  questionId: string;
  questionStemId?: string | null;
  questionType?: string | null;
}): ProgressQuestionRef {
  return {
    id: question.questionId,
    stemId: question.questionStemId ?? question.questionId,
    questionType: question.questionType ?? null,
  };
}
