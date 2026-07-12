"use client";

import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";

type SignupCompletePlanStepProps = {
  onComplete: () => void;
};

export function SignupCompletePlanStep({ onComplete }: SignupCompletePlanStepProps) {
  return (
    <PlanPicker
      variant="onboarding"
      surfaceTheme="app"
      selectorTheme="app"
      checkoutReturnContext="signup_onboarding"
      onContinueFree={onComplete}
    />
  );
}
