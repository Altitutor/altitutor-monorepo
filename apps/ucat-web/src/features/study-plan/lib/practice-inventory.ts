type PracticeInventoryStem = {
  id: string | null;
  section_id: string | null;
  question_stem_category_id: string | null;
  question_ids: readonly string[] | null;
  question_tag_ids: readonly string[] | null;
};

type PracticeAttempt = {
  id: string | null;
  question_id: string | null;
  score: number | null;
  is_submitted: boolean | null;
  student_practice_session_id: string | null;
  student_question_set_attempt_id: string | null;
};

type TagSignal = {
  id: string;
  sectionId: string;
  categoryId: string;
  availableQuestionCount: number;
  independentSessionCount: number;
  weaknessScore: number;
};

/** Summarises the same accessible stem inventory used by Practice selection. */
export function countPracticeQuestionsByCategory(
  stems: readonly Pick<
    PracticeInventoryStem,
    "question_stem_category_id" | "question_ids"
  >[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stem of stems) {
    if (!stem.question_stem_category_id) continue;
    counts.set(
      stem.question_stem_category_id,
      (counts.get(stem.question_stem_category_id) ?? 0) +
        (stem.question_ids?.length ?? 0),
    );
  }
  return counts;
}

/** Derives weak-tag sampling evidence from the same whole stems Practice can select. */
export function deriveActivityTagSignals(
  stems: readonly PracticeInventoryStem[],
  attempts: readonly PracticeAttempt[],
): TagSignal[] {
  type Accumulator = {
    id: string;
    sectionId: string;
    categoryId: string;
    availableQuestionCount: number;
    sessionIds: Set<string>;
    weaknessTotal: number;
    evidenceCount: number;
  };
  const signals = new Map<string, Accumulator>();
  const stemsByQuestionId = new Map<string, PracticeInventoryStem>();

  for (const stem of stems) {
    for (const questionId of stem.question_ids ?? []) {
      stemsByQuestionId.set(questionId, stem);
    }
    if (!stem.section_id || !stem.question_stem_category_id) continue;
    for (const tagId of stem.question_tag_ids ?? []) {
      const key = `${tagId}:${stem.question_stem_category_id}`;
      const signal = signals.get(key) ?? {
        id: tagId,
        sectionId: stem.section_id,
        categoryId: stem.question_stem_category_id,
        availableQuestionCount: 0,
        sessionIds: new Set<string>(),
        weaknessTotal: 0,
        evidenceCount: 0,
      };
      signal.availableQuestionCount += stem.question_ids?.length ?? 0;
      signals.set(key, signal);
    }
  }

  for (const attempt of attempts) {
    if (!attempt.is_submitted || !attempt.question_id) continue;
    const stem = stemsByQuestionId.get(attempt.question_id);
    if (!stem?.question_stem_category_id) continue;
    for (const tagId of stem.question_tag_ids ?? []) {
      const signal = signals.get(`${tagId}:${stem.question_stem_category_id}`);
      if (!signal) continue;
      signal.sessionIds.add(
        attempt.student_practice_session_id
          ? `practice:${attempt.student_practice_session_id}`
          : attempt.student_question_set_attempt_id
            ? `set:${attempt.student_question_set_attempt_id}`
            : `attempt:${attempt.id ?? attempt.question_id}`,
      );
      signal.weaknessTotal += (attempt.score ?? 0) > 0 ? 0 : 1;
      signal.evidenceCount += 1;
    }
  }

  return [...signals.values()].map((signal) => ({
    id: signal.id,
    sectionId: signal.sectionId,
    categoryId: signal.categoryId,
    availableQuestionCount: signal.availableQuestionCount,
    independentSessionCount: signal.sessionIds.size,
    weaknessScore:
      signal.evidenceCount > 0
        ? signal.weaknessTotal / signal.evidenceCount
        : 0.5,
  }));
}
