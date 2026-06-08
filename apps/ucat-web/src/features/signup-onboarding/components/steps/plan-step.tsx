"use client";

import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";

type SignupCompletePlanStepProps = {
  onComplete: () => void;
};

export function SignupCompletePlanStep({ onComplete }: SignupCompletePlanStepProps) {
  return (
    <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-sm md:p-8">
      <PlanPicker
        variant="onboarding"
        surfaceTheme="app"
        selectorTheme="app"
        checkoutReturnContext="signup_onboarding"
        onContinueFree={onComplete}
      />
    </div>
  );
}
