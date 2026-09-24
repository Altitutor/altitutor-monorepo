import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";

export const SIGNUP_STEP = {
  DETAILS: 1,
  PASSWORD: 2,
  ACQUISITION_SOURCE: 3,
  SAMPLER: 4,
  PLAN: 5,
} as const satisfies Record<string, SignupOnboardingStep>;

export function uiStepIndex(step: SignupOnboardingStep): number {
  return step;
}

export const SIGNUP_UI_STEP_COUNT = 5;

export function isSignupOnboardingStep(
  value: unknown,
): value is SignupOnboardingStep {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}
