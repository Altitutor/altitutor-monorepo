export const TARGET_SCORE_MIN = 900;
export const TARGET_SCORE_MAX = 2700;
export const TARGET_SCORE_STEP = 10;

export function roundTargetScore(value: number): number {
  const rounded =
    Math.round(value / TARGET_SCORE_STEP) * TARGET_SCORE_STEP;
  return Math.min(
    TARGET_SCORE_MAX,
    Math.max(TARGET_SCORE_MIN, rounded),
  );
}

export function validateTargetScore(value: string | number): string | null {
  if (value === "" || value === null || value === undefined) {
    return "Enter a target score.";
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return "Target score must be a whole number.";
  }
  if (parsed < TARGET_SCORE_MIN || parsed > TARGET_SCORE_MAX) {
    return `Target score must be between ${TARGET_SCORE_MIN} and ${TARGET_SCORE_MAX}.`;
  }

  return null;
}

export function parseTargetScore(value: string | number): number | null {
  const validationError = validateTargetScore(value);
  if (validationError) return null;
  return roundTargetScore(Number(value));
}

export function normalizeTargetScoreDraft(draft: string): {
  value: number | null;
  error: string | null;
} {
  const error = validateTargetScore(draft);
  if (error) {
    return { value: null, error };
  }

  return {
    value: roundTargetScore(Number(draft)),
    error: null,
  };
}
