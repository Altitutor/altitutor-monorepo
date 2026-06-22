export type CategoryBreakdownEntry = {
  name: string;
  score: number;
  total: number;
};

type QuestionAttemptForCategoryBreakdown = {
  questionStemCategoryId?: string | null;
  categoryName?: string | null;
  questionType: string | null;
  score?: number | null;
};

export function computeCategoryBreakdown(
  attempts: QuestionAttemptForCategoryBreakdown[],
): CategoryBreakdownEntry[] {
  const byCategory = new Map<
    string,
    { name: string; score: number; total: number }
  >();

  for (const q of attempts) {
    const catKey = q.questionStemCategoryId ?? "__uncategorized__";
    const catName = q.categoryName ?? "Uncategorized";
    const maxScore = q.questionType === "syllogism" ? 2 : 1;
    const score = q.score ?? 0;
    const entry = byCategory.get(catKey);
    if (entry) {
      entry.score += score;
      entry.total += maxScore;
    } else {
      byCategory.set(catKey, { name: catName, score, total: maxScore });
    }
  }

  return [...byCategory.entries()]
    .map(([, v]) => v)
    .sort((a, b) => a.name.localeCompare(b.name));
}
