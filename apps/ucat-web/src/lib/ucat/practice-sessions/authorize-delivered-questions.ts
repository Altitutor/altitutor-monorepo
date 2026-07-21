type DeliveredStemSnapshot = {
  questions?: unknown;
};

type DeliveredQuestionSnapshot = {
  id?: unknown;
};

function getDeliveredMembership(stemsSnapshot: unknown): {
  questionIds: Set<string>;
} {
  const questionIds = new Set<string>();

  if (!Array.isArray(stemsSnapshot)) {
    return { questionIds };
  }

  for (const value of stemsSnapshot) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const stem = value as DeliveredStemSnapshot;
    if (!Array.isArray(stem.questions)) continue;

    for (const questionValue of stem.questions) {
      if (
        !questionValue ||
        typeof questionValue !== "object" ||
        Array.isArray(questionValue)
      ) {
        continue;
      }
      const question = questionValue as DeliveredQuestionSnapshot;
      if (typeof question.id === "string") questionIds.add(question.id);
    }
  }

  return { questionIds };
}

/**
 * Returns question IDs absent from the immutable delivered-stem snapshot.
 */
export function findUndeliveredPracticeQuestionIds(
  stemsSnapshot: unknown,
  requestedQuestionIds: string[],
): string[] {
  const requestedIds = Array.from(
    new Set(requestedQuestionIds.filter((questionId) => questionId.length > 0)),
  );
  const { questionIds } = getDeliveredMembership(stemsSnapshot);
  return requestedIds.filter((questionId) => !questionIds.has(questionId));
}
