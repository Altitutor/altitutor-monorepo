"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { CardComponentProps } from "nextstepjs";
import { useNextStep } from "nextstepjs";
import {
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-catalog";
import type { ContextualTourStep } from "@/features/onboarding/config/tour-steps";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
}: CardComponentProps) {
  const { currentTour, closeNextStep } = useNextStep();
  // nextstepjs types `step` as always defined, but it can briefly be missing
  // while a route or optional step changes.
  const safeStep = step as ContextualTourStep | undefined;
  if (!safeStep || typeof document === "undefined") return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isQuestionEngineTour = currentTour === UCAT_QUESTION_ENGINE_TOUR;
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);
  const requiresInteraction = Boolean(safeStep.interactionSelector);
  const teachesStudyOrb =
    safeStep.interactionSelector === "[data-tour='study-guidance-orb']";

  const postpone = () => {
    if (!isQuestionEngineTour) {
      closeNextStep();
      return;
    }

    const returnTo = new URLSearchParams(window.location.search).get(
      "returnTo",
    );
    const confirmed = window.confirm(
      returnTo?.startsWith("/settings")
        ? "Exit the tutorial and return to Settings?"
        : "Exit the tutorial and begin your attempt?",
    );
    if (confirmed) skipTour?.();
  };

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed z-[1350] flex",
        teachesStudyOrb
          ? "inset-x-0 top-0 items-start p-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:top-auto sm:items-end sm:p-0"
          : "inset-x-0 bottom-0 items-end p-0 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:p-0",
      )}
    >
      <section
        data-name="nextstep-card"
        className={cn(
          "pointer-events-auto relative max-h-[min(78dvh,38rem)] w-full overflow-y-auto rounded-t-[1.5rem] border border-border/70 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300",
          "sm:w-[min(25rem,calc(100vw-3rem))] sm:rounded-[1.5rem] sm:p-5",
          teachesStudyOrb && "rounded-[1.5rem] pb-5",
          UCAT_SURFACE_CARD,
        )}
        role="dialog"
        aria-labelledby="ucat-tutorial-title"
        aria-describedby="ucat-tutorial-content"
      >
        <div
          className="absolute inset-x-5 top-0 h-0.5 overflow-hidden rounded-full bg-primary/10"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          key={currentStep}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-200"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden
            >
              {safeStep.icon ?? <Sparkles className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Step {currentStep + 1} of {totalSteps}
              </p>
              <h2
                id="ucat-tutorial-title"
                className="mt-0.5 text-lg font-semibold leading-snug"
              >
                {safeStep.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={postpone}
              aria-label={isQuestionEngineTour ? "Exit tutorial" : "Not now"}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            id="ucat-tutorial-content"
            className="mt-4 text-sm leading-relaxed text-card-foreground/90"
          >
            {safeStep.content}
          </div>

          <div
            className="sr-only"
            role="progressbar"
            aria-label="Tutorial progress"
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={currentStep + 1}
          />

          {requiresInteraction ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-primary/[0.07] px-3 py-2.5 text-sm font-medium text-primary">
              <MousePointer2
                className="h-4 w-4 shrink-0 motion-safe:animate-pulse"
                aria-hidden
              />
              Use the highlighted control to continue
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            {safeStep.showSkip && skipTour && !isQuestionEngineTour ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={skipTour}
              >
                Skip tutorial
              </Button>
            ) : (
              <span />
            )}

            {safeStep.showControls ? (
              <div className="ml-auto flex items-center gap-2">
                {!isFirst ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={prevStep}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={nextStep}
                  className="gap-1"
                >
                  {isLast ? "Finish" : "Next"}
                  {isLast ? null : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
