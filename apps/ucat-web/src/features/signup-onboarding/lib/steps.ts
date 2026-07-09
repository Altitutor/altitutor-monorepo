import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";

export const SIGNUP_STEP = {
  DETAILS: 1,
  PASSWORD: 2,
  PLAN: 3,
} as const satisfies Record<string, SignupOnboardingStep>;

export function uiStepIndex(step: SignupOnboardingStep): number {
  return step;
}

export const SIGNUP_UI_STEP_COUNT = 3;

export function isSignupOnboardingStep(value: unknown): value is SignupOnboardingStep {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3;
}
