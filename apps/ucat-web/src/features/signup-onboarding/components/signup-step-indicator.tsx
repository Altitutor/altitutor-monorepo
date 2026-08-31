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
    <div className="mb-10 flex items-center gap-2 sm:gap-3">
      {Array.from({ length: SIGNUP_UI_STEP_COUNT }, (_, i) => {
        const s = i + 1;
        const isComplete = s < activeUiStep;
        const isActive = s === activeUiStep;

        return (
          <div key={s} className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                `flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${typo.dataMono}`,
                isActive &&
                  "scale-105 bg-primary text-primary-foreground dark:bg-accent dark:text-primary-foreground",
                isComplete &&
                  "bg-primary/15 text-primary dark:bg-accent/20 dark:text-accent",
                !isActive && !isComplete && "bg-muted text-muted-foreground",
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
                  "h-px w-5 transition-colors duration-300 sm:w-12",
                  isComplete ? "bg-primary/40 dark:bg-accent/40" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
