export const UCAT_QUESTION_DIFFICULTY_BY_TARGET = {
  easy: 0.25,
  medium: 0.55,
  hard: 0.82,
} as const;

export type UcatQuestionDifficultyTarget = keyof typeof UCAT_QUESTION_DIFFICULTY_BY_TARGET;

export const UCAT_QUESTION_DIFFICULTY_DEFINITION =
  "Proportion of the target UCAT candidate cohort expected to answer incorrectly on first exposure under realistic section timing and without assistance.";

export function ucatQuestionDifficultyForTarget(
  target: string | null | undefined,
): number | null {
  if (target === "easy" || target === "medium" || target === "hard") {
    return UCAT_QUESTION_DIFFICULTY_BY_TARGET[target];
  }
  return null;
}

export function ucatQuestionDifficultyPercent(difficulty: number): number {
  return Math.round(Math.min(1, Math.max(0, difficulty)) * 100);
}

export function formatUcatQuestionDifficulty(difficulty: number): string {
  return `${ucatQuestionDifficultyPercent(difficulty)}% expected incorrect`;
}
