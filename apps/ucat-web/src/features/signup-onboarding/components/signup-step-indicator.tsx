"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  SIGNUP_UI_STEP_COUNT,
  uiStepIndex,
} from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

type SignupStepIndicatorProps = {
  step: SignupOnboardingStep;
};

export function SignupStepIndicator({ step }: SignupStepIndicatorProps) {
  const activeUiStep = uiStepIndex(step);

  return (
    <div className="mb-10 flex items-center gap-3">
      {Array.from({ length: SIGNUP_UI_STEP_COUNT }, (_, i) => {
        const s = i + 1;
        const isComplete = s < activeUiStep;
        const isActive = s === activeUiStep;

        return (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                `flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${typo.dataMono}`,
                isActive && "bg-marketing-accent text-marketing-charcoal scale-105",
                isComplete && "bg-marketing-accent/30 text-marketing-accent",
                !isActive && !isComplete && "bg-white/10 text-marketing-cream/30",
              )}
            >
              {isComplete ? (
                <svg viewBox="0 0 12 10" fill="none" className="h-3.5 w-3.5">
                  <path
                    d="M1 5l3.5 3.5L11 1"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < SIGNUP_UI_STEP_COUNT ? (
              <div
                className={cn(
                  "h-px w-12 transition-colors duration-300",
                  isComplete ? "bg-marketing-accent/50" : "bg-white/10",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
