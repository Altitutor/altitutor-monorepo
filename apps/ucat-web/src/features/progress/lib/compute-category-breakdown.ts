import {
  progressPointsForQuestion,
  toProgressQuestionRef,
} from "@altitutor/shared";

export type CategoryBreakdownEntry = {
  name: string;
  score: number;
  total: number;
};

type QuestionAttemptForCategoryBreakdown = {
  questionId: string;
  questionStemId?: string | null;
  questionStemCategoryId?: string | null;
  categoryName?: string | null;
  answerScheme: import("@altitutor/ucat-response-contract").AnswerScheme["kind"] | null;
  score?: number | null;
};

export function computeCategoryBreakdown(
  attempts: QuestionAttemptForCategoryBreakdown[],
): CategoryBreakdownEntry[] {
  const byCategory = new Map<
    string,
    {
      name: string;
      score: number;
      total: number;
      groupedStems: Set<string>;
    }
  >();

  for (const q of attempts) {
    const catKey = q.questionStemCategoryId ?? "__uncategorized__";
    const catName = q.categoryName ?? "Uncategorized";
    const score = q.score ?? 0;
    const entry = byCategory.get(catKey) ?? {
      name: catName,
      score: 0,
      total: 0,
      groupedStems: new Set<string>(),
    };
    entry.score += score;
    entry.total += progressPointsForQuestion(
      toProgressQuestionRef(q),
      entry.groupedStems,
    );
    byCategory.set(catKey, entry);
  }

  return [...byCategory.entries()]
    .map(([, v]) => v)
    .sort((a, b) => a.name.localeCompare(b.name));
}
