'use client';

import { cn } from '@/shared/utils';

type WelcomeStepIndicatorProps = {
  /** 1-based macro step index. */
  activeStep: number;
  totalSteps?: number;
};

export function WelcomeStepIndicator({
  activeStep,
  totalSteps = 3,
}: WelcomeStepIndicatorProps) {
  return (
    <div className="mb-8 flex items-center gap-3" aria-hidden>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isComplete = step < activeStep;
        const isActive = step === activeStep;

        return (
          <div key={step} className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                isActive && 'scale-105 bg-primary text-primary-foreground',
                isComplete && 'bg-primary/20 text-primary',
                !isActive && !isComplete && 'bg-muted text-muted-foreground/50',
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
                step
              )}
            </div>
            {step < totalSteps ? (
              <div
                className={cn(
                  'h-px w-10 transition-colors duration-300 sm:w-12',
                  isComplete ? 'bg-primary/40' : 'bg-muted-foreground/15',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
