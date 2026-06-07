import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  isProfileSetupComplete,
  PROFILE_SETUP_COMPLETE_KEY,
} from "@/features/auth/lib/signup-profile";
import {
  isSignupOnboardingStep,
  SIGNUP_STEP,
} from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";

type StudentSignupRow = {
  ucat_signup_step: number | null;
  ucat_signup_completed_at: string | null;
  ucat_onboarding_completed_at: string | null;
  ucat_test_year: number | null;
  first_name: string | null;
  last_name: string | null;
};

export type ResolvedSignupState = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
  testYear: number | null;
};

function clampStep(value: number | null | undefined): SignupOnboardingStep {
  if (value != null && isSignupOnboardingStep(value)) return value;
  return SIGNUP_STEP.DETAILS;
}

export function resolveSignupState(
  student: StudentSignupRow | null,
  profileSetupComplete: boolean,
): ResolvedSignupState {
  const signupCompleted = Boolean(student?.ucat_signup_completed_at);
  const planChoiceCompleted = Boolean(student?.ucat_onboarding_completed_at);
  const testYear = student?.ucat_test_year ?? null;

  if (signupCompleted) {
    return {
      step: SIGNUP_STEP.TARGET_SCORES,
      signupCompleted: true,
      planChoiceCompleted,
      testYear,
    };
  }

  let step = clampStep(student?.ucat_signup_step);

  if (planChoiceCompleted && step < SIGNUP_STEP.TEST_DETAILS) {
    step = SIGNUP_STEP.TEST_DETAILS;
  } else if (profileSetupComplete && !planChoiceCompleted && step < SIGNUP_STEP.PLAN) {
    step = SIGNUP_STEP.PLAN;
  } else if (
    student?.first_name?.trim() &&
    student?.last_name?.trim() &&
    !profileSetupComplete &&
    step < SIGNUP_STEP.PASSWORD
  ) {
    step = SIGNUP_STEP.PASSWORD;
  }

  return {
    step,
    signupCompleted: false,
    planChoiceCompleted,
    testYear,
  };
}

export async function loadStudentSignupRow(
  userId: string,
): Promise<StudentSignupRow | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "ucat_signup_step, ucat_signup_completed_at, ucat_onboarding_completed_at, ucat_test_year, first_name, last_name",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function resolveSignupStateForUser(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}): Promise<ResolvedSignupState> {
  const student = await loadStudentSignupRow(user.id);
  return resolveSignupState(
    student,
    isProfileSetupComplete(user.user_metadata),
  );
}

export { PROFILE_SETUP_COMPLETE_KEY };
