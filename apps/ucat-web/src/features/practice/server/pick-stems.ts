import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeSelectionInput } from "@/features/practice/model/types";

export type PracticeSectionIndexRow = {
  id: string;
  section_number: number;
  time_per_question: number | null;
  number_of_questions: number | null;
};

export type PracticeStemIndexRow = {
  id: string;
  section_id: string;
  question_stem_category_id: string | null;
  question_ids: string[] | null;
  question_tag_ids?: string[] | null;
};

export type PracticeQuestionAttemptIndexRow = {
  question_id: string;
  score: number | null;
  is_submitted: boolean;
};

const SECTION_KEY_TO_NUMBER: Record<string, number> = {
  verbal_reasoning: 1,
  decision_making: 2,
  quantitative_reasoning: 3,
  situational_judgement: 4,
};

function computeQuestionStatus(
  attempts: PracticeQuestionAttemptIndexRow[] | undefined,
) {
  if (!attempts || attempts.length === 0) {
    return "unanswered" as const;
  }

  const submitted = attempts.filter((row) => row.is_submitted);
  if (submitted.length === 0) {
    return "unanswered" as const;
  }

  const anyCorrect = submitted.some((row) => (row.score ?? 0) > 0);
  return anyCorrect ? ("correct" as const) : ("incorrect" as const);
}

function resolveEffectiveQuestionCount(
  requested: number,
  sections: PracticeSectionIndexRow[],
  availableQuestions: number,
): number {
  const maxBySections = sections.reduce((sum, section) => {
    return sum + (section.number_of_questions ?? 0);
  }, 0);

  const hardCap = maxBySections > 0 ? maxBySections : availableQuestions;
  const clampedRequested = Math.max(1, Math.floor(requested));

  return Math.min(clampedRequested, hardCap, availableQuestions);
}

/** Fisher–Yates shuffle (mutates array in place). */
function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

export type PickStemsOptions = {
  /** Exclude these stem IDs from the result. Used for unlimited mode to avoid repeats. */
  excludeStemIds?: string[];
  /** When set, return at most this many stems. For unlimited mode, use 1. */
  limitStems?: number;
  /** When false, do not pick a single oversized fallback stem above questionCount. */
  allowOversizedFallback?: boolean;
  /** Stable ordering for read-only development diagnostics. */
  deterministic?: boolean;
  /** Reuse an already-loaded catalogue snapshot for read-only diagnostics. */
  preloaded?: {
    sections: PracticeSectionIndexRow[];
    stems: PracticeStemIndexRow[];
    attempts: PracticeQuestionAttemptIndexRow[];
  };
};

export type PickStemsResult = {
  chosenStemIds: string[];
  totalMatchingQuestions: number;
  questionCount: number;
  sectionRows: PracticeSectionIndexRow[];
  stemDetailRows: PracticeStemIndexRow[];
  selectionTrace: Array<{
    stemId: string;
    questionCount: number;
    categoryId: string | null;
    matchedTagIds: string[];
    fallbackTier: number;
  }>;
};

export function maximumWholeStemDose(
  questionCounts: number[],
  targetQuestionCount: number,
): number {
  const attainable = new Set([0]);
  for (const count of questionCounts) {
    if (count <= 0 || count > targetQuestionCount) continue;
    for (const existing of [...attainable]) {
      if (existing + count <= targetQuestionCount) {
        attainable.add(existing + count);
      }
    }
  }
  return Math.max(...attainable);
}

export function maximumTieredWholeStemDose(
  tierQuestionCounts: number[][],
  targetQuestionCount: number,
): number {
  let capacity = targetQuestionCount;
  let dose = 0;
  for (const questionCounts of tierQuestionCounts) {
    const tierDose = maximumWholeStemDose(questionCounts, capacity);
    dose += tierDose;
    capacity -= tierDose;
  }
  return dose;
}

/**
 * Picks question stems matching the given filters. Shared by set generator and practice.
 * Candidates are shuffled (Fisher–Yates) then greedily filled to the target question count.
 * Returns chosen stem IDs and metadata. Does not persist anything.
 */
export async function pickStems(
  supabase: SupabaseClient,
  input: PracticeSelectionInput,
  options?: PickStemsOptions,
): Promise<PickStemsResult> {
  const sectionNumber = SECTION_KEY_TO_NUMBER[input.section];
  if (typeof sectionNumber !== "number") {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows: [],
      stemDetailRows: [],
      selectionTrace: [],
    };
  }

  const sectionNumbers = [sectionNumber];

  const sectionQuery = options?.preloaded
    ? {
        data: options.preloaded.sections.filter((section) =>
          sectionNumbers.includes(section.section_number),
        ),
        error: null,
      }
    : await supabase
        .from("vstudent_ucat_sections")
        .select("id,section_number,time_per_question,number_of_questions")
        .in("section_number", sectionNumbers);

  if (sectionQuery.error || !sectionQuery.data?.length) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows: [],
      stemDetailRows: [],
      selectionTrace: [],
    };
  }

  const sectionRows = sectionQuery.data as PracticeSectionIndexRow[];
  const sectionIds = sectionRows.map((row) => row.id);

  let stems: PracticeStemIndexRow[] | null;
  let stemsError: { message: string } | null;
  if (options?.preloaded) {
    stems = options.preloaded.stems.filter(
      (stem) =>
        sectionIds.includes(stem.section_id) &&
        (!input.categoryIds?.length ||
          (stem.question_stem_category_id != null &&
            input.categoryIds.includes(stem.question_stem_category_id))),
    );
    stemsError = null;
  } else {
    let stemsQuery = supabase
      .from("vstudent_ucat_practice_stem_index")
      .select(
        "id,section_id,question_stem_category_id,question_ids,question_tag_ids",
      )
      .in("section_id", sectionIds);

    if (input.categoryIds && input.categoryIds.length > 0) {
      stemsQuery = stemsQuery.in("question_stem_category_id", input.categoryIds);
    }
    const result = await stemsQuery;
    stems = result.data as PracticeStemIndexRow[] | null;
    stemsError = result.error;
  }

  if (stemsError || !stems?.length) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows,
      stemDetailRows: [],
      selectionTrace: [],
    };
  }

  const stemDetailRows = stems as PracticeStemIndexRow[];

  const allQuestions: { stemId: string; questionId: string }[] = [];
  for (const stem of stemDetailRows) {
    for (const questionId of stem.question_ids ?? []) {
      allQuestions.push({ stemId: stem.id, questionId });
    }
  }

  if (allQuestions.length === 0) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows,
      stemDetailRows,
      selectionTrace: [],
    };
  }

  let attemptsByQuestionId = new Map<
    string,
    PracticeQuestionAttemptIndexRow[]
  >();

  if (
    input.unansweredOnly ||
    input.incorrectOnly ||
    (input.questionTagIds?.length ?? 0) > 0
  ) {
    const questionIds = Array.from(
      new Set(allQuestions.map((q) => q.questionId)),
    );

    const attemptsResult = options?.preloaded
      ? {
          data: options.preloaded.attempts.filter((attempt) =>
            questionIds.includes(attempt.question_id),
          ),
          error: null,
        }
      : await supabase
          .from("vstudent_ucat_my_question_attempts")
          .select("question_id,score,is_submitted")
          .in("question_id", questionIds);

    if (!attemptsResult.error && attemptsResult.data) {
      const attemptRows =
        attemptsResult.data as PracticeQuestionAttemptIndexRow[];
      attemptsByQuestionId = attemptRows.reduce((map, row) => {
        const existing = map.get(row.question_id) ?? [];
        existing.push(row);
        map.set(row.question_id, existing);
        return map;
      }, new Map<string, PracticeQuestionAttemptIndexRow[]>());
    }
  }

  type StemAggregate = {
    stem: PracticeStemIndexRow;
    allQuestionsCount: number;
    matchingQuestionsCount: number;
    tier: number;
    matchedTagIds: string[];
  };

  const aggregatesByStemId = new Map<string, StemAggregate>();

  for (const stem of stemDetailRows) {
    const questionIds = stem.question_ids ?? [];
    let allCount = 0;
    let matchingCount = 0;
    let allUnanswered = true;
    let anyIncorrect = false;

    for (const questionId of questionIds) {
      allCount += 1;

      let performanceOk = true;
      if (input.unansweredOnly || input.incorrectOnly) {
        const status = computeQuestionStatus(
          attemptsByQuestionId.get(questionId),
        );
        allUnanswered &&= status === "unanswered";
        anyIncorrect ||= status === "incorrect";
        if (input.unansweredOnly) {
          performanceOk = status === "unanswered";
        } else if (input.incorrectOnly) {
          performanceOk = status === "incorrect";
        }
      }

      if (!input.unansweredOnly && !input.incorrectOnly) {
        const status = computeQuestionStatus(attemptsByQuestionId.get(questionId));
        allUnanswered &&= status === "unanswered";
        anyIncorrect ||= status === "incorrect";
      }

      if (performanceOk) {
        matchingCount += 1;
      }
    }

    const preferredTags = new Set(input.questionTagIds ?? []);
    const matchedTagIds = (stem.question_tag_ids ?? []).filter((tagId) =>
      preferredTags.has(tagId),
    );
    const tagMatched = matchedTagIds.length > 0;
    const tier = allUnanswered
      ? tagMatched
        ? 0
        : 1
      : tagMatched && anyIncorrect
        ? 2
        : 3;
    aggregatesByStemId.set(stem.id, {
      stem,
      allQuestionsCount: allCount,
      matchingQuestionsCount: matchingCount,
      tier,
      matchedTagIds,
    });
  }

  let candidateStems: StemAggregate[] = Array.from(
    aggregatesByStemId.values(),
  ).filter(
    (agg) => agg.matchingQuestionsCount > 0 && agg.allQuestionsCount > 0,
  );

  const excludeSet = new Set(options?.excludeStemIds ?? []);
  if (excludeSet.size > 0) {
    candidateStems = candidateStems.filter(
      (agg) => !excludeSet.has(agg.stem.id),
    );
  }

  if (candidateStems.length === 0) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows,
      stemDetailRows,
      selectionTrace: [],
    };
  }

  const totalMatchingQuestions = candidateStems.reduce(
    (sum, agg) => sum + agg.matchingQuestionsCount,
    0,
  );
  const availableQuestions = candidateStems.reduce(
    (sum, agg) => sum + agg.allQuestionsCount,
    0,
  );

  const limitStems = options?.limitStems;
  const targetQuestionCount =
    limitStems != null
      ? Infinity
      : resolveEffectiveQuestionCount(
          input.questionCount,
          sectionRows,
          availableQuestions,
        );

  const chosenStems: PracticeStemIndexRow[] = [];
  let runningQuestions = 0;
  const remainingDoseByTier = new Map<number, number>();
  if (limitStems == null) {
    const tiers = [...new Set(candidateStems.map((item) => item.tier))].sort(
      (left, right) => left - right,
    );
    let capacity = targetQuestionCount;
    for (const tier of tiers) {
      const tierDose = maximumWholeStemDose(
        candidateStems
          .filter((item) => item.tier === tier)
          .map((item) => item.allQuestionsCount),
        capacity,
      );
      remainingDoseByTier.set(tier, tierDose);
      capacity -= tierDose;
    }
  }

  // Randomise ties, then greedily favour the least-represented configured
  // tags/categories inside each fallback tier.
  if (!options?.deterministic) shuffleInPlace(candidateStems);
  const tagUse = new Map<string, number>();
  const categoryUse = new Map<string, number>();
  const remaining = [...candidateStems];
  while (remaining.length > 0) {
    if (limitStems != null && chosenStems.length >= limitStems) break;
    const fitting = remaining
      .map((aggregate, index) => ({ aggregate, index }))
      .filter(
        ({ aggregate, index }) => {
          if (limitStems != null) return true;
          const activeTier = [...remainingDoseByTier]
            .filter(([, dose]) => dose > 0)
            .sort(([left], [right]) => left - right)[0]?.[0];
          if (aggregate.tier !== activeTier) return false;
          const tierTarget = remainingDoseByTier.get(aggregate.tier) ?? 0;
          const remainingTarget =
            tierTarget - aggregate.allQuestionsCount;
          if (remainingTarget < 0) return false;
          return (
            maximumWholeStemDose(
              remaining
                .filter(
                  (candidate, candidateIndex) =>
                    candidateIndex !== index &&
                    candidate.tier === aggregate.tier,
                )
                .map((candidate) => candidate.allQuestionsCount),
              remainingTarget,
            ) === remainingTarget
          );
        },
      )
      .sort((left, right) => {
        const leftTagUse = left.aggregate.matchedTagIds.length
          ? Math.min(
              ...left.aggregate.matchedTagIds.map((id) => tagUse.get(id) ?? 0),
            )
          : 0;
        const rightTagUse = right.aggregate.matchedTagIds.length
          ? Math.min(
              ...right.aggregate.matchedTagIds.map((id) => tagUse.get(id) ?? 0),
            )
          : 0;
        const leftCategoryUse = left.aggregate.stem.question_stem_category_id
          ? (categoryUse.get(left.aggregate.stem.question_stem_category_id) ?? 0)
          : 0;
        const rightCategoryUse = right.aggregate.stem.question_stem_category_id
          ? (categoryUse.get(right.aggregate.stem.question_stem_category_id) ?? 0)
          : 0;
        return (
          left.aggregate.tier - right.aggregate.tier ||
          leftTagUse - rightTagUse ||
          leftCategoryUse - rightCategoryUse ||
          left.aggregate.stem.id.localeCompare(right.aggregate.stem.id)
        );
      });
    const selected = fitting[0];
    if (!selected) break;
    remaining.splice(selected.index, 1);
    chosenStems.push(selected.aggregate.stem);
    runningQuestions += selected.aggregate.allQuestionsCount;
    if (limitStems == null) {
      remainingDoseByTier.set(
        selected.aggregate.tier,
        (remainingDoseByTier.get(selected.aggregate.tier) ?? 0) -
          selected.aggregate.allQuestionsCount,
      );
    }
    for (const tagId of selected.aggregate.matchedTagIds) {
      tagUse.set(tagId, (tagUse.get(tagId) ?? 0) + 1);
    }
    const categoryId = selected.aggregate.stem.question_stem_category_id;
    if (categoryId) {
      categoryUse.set(categoryId, (categoryUse.get(categoryId) ?? 0) + 1);
    }
  }

  if (
    chosenStems.length === 0 &&
    limitStems == null &&
    options?.allowOversizedFallback !== false
  ) {
    const smallest = candidateStems.reduce((min, current) => {
      if (!min || current.allQuestionsCount < min.allQuestionsCount)
        return current;
      return min;
    });
    if (smallest) {
      chosenStems.push(smallest.stem);
      runningQuestions = smallest.allQuestionsCount;
    }
  }

  return {
    chosenStemIds: chosenStems.map((s) => s.id),
    totalMatchingQuestions,
    questionCount: runningQuestions,
    sectionRows,
    stemDetailRows,
    selectionTrace: chosenStems.map((stem) => {
      const aggregate = aggregatesByStemId.get(stem.id)!;
      return {
        stemId: stem.id,
        questionCount: aggregate.allQuestionsCount,
        categoryId: stem.question_stem_category_id,
        matchedTagIds: aggregate.matchedTagIds,
        fallbackTier: aggregate.tier,
      };
    }),
  };
}
