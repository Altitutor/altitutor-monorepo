"use client";

import type { CardComponentProps } from "nextstepjs";
import { Button } from "@altitutor/ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Themed onboarding card used by `<NextStep cardComponent={...}>`.
 *
 * - Uses the app's design tokens (`bg-card`, `text-foreground`, `bg-primary`)
 *   so the card follows light/dark themes automatically.
 * - Width is capped via `min(20rem, calc(100vw - 2rem))` so the card never
 *   overflows the viewport on small windows.
 */
export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card text-card-foreground shadow-xl",
        // Cap width to viewport so the card never extends off-screen on narrow viewports.
        "w-[min(20rem,calc(100vw-2rem))] max-w-sm",
        "p-5",
      )}
      role="dialog"
      aria-labelledby="ucat-onboarding-title"
    >
      {arrow}

      <div className="flex items-start gap-3">
        {step.icon ? (
          <span className="text-2xl leading-none" aria-hidden>
            {step.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </p>
          <h3
            id="ucat-onboarding-title"
            className="mt-0.5 text-base font-semibold leading-snug"
          >
            {step.title}
          </h3>
        </div>
        {step.showSkip && skipTour ? (
          <button
            type="button"
            onClick={skipTour}
            aria-label="Skip tour"
            className={cn(
              "-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 max-h-[40vh] overflow-y-auto text-sm leading-relaxed text-card-foreground/90">
        {step.content}
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={currentStep + 1}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {step.showControls ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="button" size="sm" onClick={nextStep} className="gap-1">
            {isLast ? "Finish" : "Next"}
            {isLast ? null : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
