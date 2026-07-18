import type { SupabaseClient } from "@supabase/supabase-js";

type DeliveredStemSnapshot = {
  id?: unknown;
  questions?: unknown;
};

type DeliveredQuestionSnapshot = {
  id?: unknown;
};

type CanonicalQuestionRow = {
  id: string;
  question_stem_id: string;
};

function getDeliveredMembership(stemsSnapshot: unknown): {
  stemIds: Set<string>;
  questionIds: Set<string>;
} {
  const stemIds = new Set<string>();
  const questionIds = new Set<string>();

  if (!Array.isArray(stemsSnapshot)) {
    return { stemIds, questionIds };
  }

  for (const value of stemsSnapshot) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const stem = value as DeliveredStemSnapshot;
    if (typeof stem.id === "string") stemIds.add(stem.id);
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

  return { stemIds, questionIds };
}

/**
 * Returns question IDs that do not belong to a stem already delivered to the
 * practice session. Rich snapshots normally answer this without a query. The
 * canonical fallback supports partial/legacy snapshots while preserving the
 * delivered-stem authorization boundary.
 */
export async function findUndeliveredPracticeQuestionIds(
  admin: SupabaseClient,
  stemsSnapshot: unknown,
  requestedQuestionIds: string[],
): Promise<string[]> {
  const requestedIds = Array.from(
    new Set(requestedQuestionIds.filter((questionId) => questionId.length > 0)),
  );
  const { stemIds, questionIds } = getDeliveredMembership(stemsSnapshot);
  const unresolvedIds = requestedIds.filter(
    (questionId) => !questionIds.has(questionId),
  );

  if (unresolvedIds.length === 0 || stemIds.size === 0) {
    return unresolvedIds;
  }

  const { data, error } = await admin
    .from("ucat_questions")
    .select("id, question_stem_id")
    .in("id", unresolvedIds)
    .is("deleted_at", null);

  if (error) throw error;

  const canonicallyDeliveredIds = new Set(
    ((data ?? []) as CanonicalQuestionRow[])
      .filter((question) => stemIds.has(question.question_stem_id))
      .map((question) => question.id),
  );

  return unresolvedIds.filter(
    (questionId) => !canonicallyDeliveredIds.has(questionId),
  );
}
