import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeSelectionInput } from "@/features/practice/model/types";

type SectionRow = {
  id: string;
  section_number: number;
  time_per_question: number | null;
  number_of_questions: number | null;
};

type StemIndexRow = {
  id: string;
  section_id: string;
  question_stem_category_id: string | null;
  question_ids: string[] | null;
};

type QuestionAttemptRow = {
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

function computeQuestionStatus(attempts: QuestionAttemptRow[] | undefined) {
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
  sections: SectionRow[],
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
};

export type PickStemsResult = {
  chosenStemIds: string[];
  totalMatchingQuestions: number;
  questionCount: number;
  sectionRows: SectionRow[];
  stemDetailRows: StemIndexRow[];
};

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
    };
  }

  const sectionNumbers = [sectionNumber];

  const { data: sections, error: sectionsError } = await supabase
    .from("vstudent_ucat_sections")
    .select("id,section_number,time_per_question,number_of_questions")
    .in("section_number", sectionNumbers);

  if (sectionsError || !sections?.length) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows: [],
      stemDetailRows: [],
    };
  }

  const sectionRows = sections as SectionRow[];
  const sectionIds = sectionRows.map((row) => row.id);

  let stemsQuery = supabase
    .from("vstudent_ucat_practice_stem_index")
    .select("id,section_id,question_stem_category_id,question_ids")
    .in("section_id", sectionIds);

  if (input.categoryIds && input.categoryIds.length > 0) {
    stemsQuery = stemsQuery.in("question_stem_category_id", input.categoryIds);
  }

  const { data: stems, error: stemsError } = await stemsQuery;

  if (stemsError || !stems?.length) {
    return {
      chosenStemIds: [],
      totalMatchingQuestions: 0,
      questionCount: 0,
      sectionRows,
      stemDetailRows: [],
    };
  }

  const stemDetailRows = stems as StemIndexRow[];

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
    };
  }

  let attemptsByQuestionId = new Map<string, QuestionAttemptRow[]>();

  if (input.unansweredOnly || input.incorrectOnly) {
    const questionIds = Array.from(
      new Set(allQuestions.map((q) => q.questionId)),
    );

    const { data: attempts, error: attemptsError } = await supabase
      .from("vstudent_ucat_my_question_attempts")
      .select("question_id,score,is_submitted")
      .in("question_id", questionIds);

    if (!attemptsError && attempts) {
      const attemptRows = attempts as QuestionAttemptRow[];
      attemptsByQuestionId = attemptRows.reduce((map, row) => {
        const existing = map.get(row.question_id) ?? [];
        existing.push(row);
        map.set(row.question_id, existing);
        return map;
      }, new Map<string, QuestionAttemptRow[]>());
    }
  }

  type StemAggregate = {
    stem: StemIndexRow;
    allQuestionsCount: number;
    matchingQuestionsCount: number;
  };

  const aggregatesByStemId = new Map<string, StemAggregate>();

  for (const stem of stemDetailRows) {
    const questionIds = stem.question_ids ?? [];
    let allCount = 0;
    let matchingCount = 0;

    for (const questionId of questionIds) {
      allCount += 1;

      let performanceOk = true;
      if (input.unansweredOnly || input.incorrectOnly) {
        const status = computeQuestionStatus(
          attemptsByQuestionId.get(questionId),
        );
        if (input.unansweredOnly) {
          performanceOk = status === "unanswered";
        } else if (input.incorrectOnly) {
          performanceOk = status === "incorrect";
        }
      }

      if (performanceOk) {
        matchingCount += 1;
      }
    }

    aggregatesByStemId.set(stem.id, {
      stem,
      allQuestionsCount: allCount,
      matchingQuestionsCount: matchingCount,
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

  const chosenStems: StemIndexRow[] = [];
  let runningQuestions = 0;

  // Random order so repeated sessions with the same filters vary.
  shuffleInPlace(candidateStems);

  for (const agg of candidateStems) {
    if (limitStems != null && chosenStems.length >= limitStems) break;
    if (runningQuestions + agg.allQuestionsCount > targetQuestionCount) {
      continue;
    }
    chosenStems.push(agg.stem);
    runningQuestions += agg.allQuestionsCount;
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
  };
}
