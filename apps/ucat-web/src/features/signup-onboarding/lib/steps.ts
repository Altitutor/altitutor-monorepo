import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";

export const SIGNUP_STEP = {
  DETAILS: 1,
  PASSWORD: 2,
  PLAN: 3,
  TEST_DETAILS: 4,
  TARGET_SCORES: 5,
} as const satisfies Record<string, SignupOnboardingStep>;

/** Progress indicator label — steps 4 and 5 both display as step 4 of 4. */
export function uiStepIndex(step: SignupOnboardingStep): number {
  if (step <= 3) return step;
  return 4;
}

export const SIGNUP_UI_STEP_COUNT = 4;

export function isSignupOnboardingStep(value: unknown): value is SignupOnboardingStep {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** UCAT ANZ sitting window for date picker constraints. */
export function ucatTestDateBounds(year: number): { min: string; max: string } {
  return {
    min: `${year}-05-01`,
    max: `${year}-09-30`,
  };
}

export function ucatTestYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y, y + 1, y + 2];
}

export const LOW_TARGET_SCORE_THRESHOLD = 1800;
export const DEFAULT_TARGET_SCORE = 800;
export const MIN_TARGET_SCORE = 300;
export const MAX_TARGET_SCORE = 800;
export const TARGET_SCORE_STEP = 10;

export function snapTargetScore(value: number): number {
  const clamped = Math.min(
    MAX_TARGET_SCORE,
    Math.max(MIN_TARGET_SCORE, value),
  );
  return Math.round(clamped / TARGET_SCORE_STEP) * TARGET_SCORE_STEP;
}

export function validateTargetScoreValue(value: string): string | null {
  if (!value.trim()) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return "Target scores must be numbers.";
  if (num < MIN_TARGET_SCORE || num > MAX_TARGET_SCORE) {
    return `Target scores must be between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}.`;
  }
  if (num % TARGET_SCORE_STEP !== 0) {
    return `Target scores must be in increments of ${TARGET_SCORE_STEP}.`;
  }
  return null;
}
