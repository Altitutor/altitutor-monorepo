"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CardComponentProps } from "nextstepjs";
import { useNextStep } from "nextstepjs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import {
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-catalog";
import {
  TUTORIAL_FEEDBACK_EVENT,
  TUTORIAL_SKIP_REQUEST_EVENT,
  type TutorialFeedback,
} from "@/features/onboarding/lib/tutorial-events";
import {
  ucatOnboardingTours,
  type ContextualTourStep,
} from "@/features/onboarding/config/tour-steps";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

function selectorExists(selector: string) {
  try {
    return document.querySelector(selector) !== null;
  } catch {
    return false;
  }
}

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
}: CardComponentProps) {
  const { currentTour, closeNextStep, setCurrentStep } = useNextStep();
  const [skipConfirmationOpen, setSkipConfirmationOpen] = useState(false);
  const [tutorialFeedback, setTutorialFeedback] = useState<
    (TutorialFeedback & { step: number; tour: string | null }) | null
  >(null);
  useEffect(() => {
    const requestSkip = () => setSkipConfirmationOpen(true);
    const showFeedback = (event: Event) => {
      const feedback = (event as CustomEvent<TutorialFeedback>).detail;
      setTutorialFeedback(
        feedback ? { ...feedback, step: currentStep, tour: currentTour } : null,
      );
    };
    window.addEventListener(TUTORIAL_SKIP_REQUEST_EVENT, requestSkip);
    window.addEventListener(TUTORIAL_FEEDBACK_EVENT, showFeedback);
    return () => {
      window.removeEventListener(TUTORIAL_SKIP_REQUEST_EVENT, requestSkip);
      window.removeEventListener(TUTORIAL_FEEDBACK_EVENT, showFeedback);
    };
  }, [currentStep, currentTour]);
  // nextstepjs types `step` as always defined, but it can briefly be missing
  // while a route or optional step changes.
  const safeStep = step as ContextualTourStep | undefined;
  if (!safeStep || typeof document === "undefined") return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isQuestionEngineTour =
    currentTour === UCAT_QUESTION_ENGINE_TOUR ||
    currentTour === UCAT_QUESTION_ENGINE_CONTROLS_TOUR;

  const configuredSteps = ucatOnboardingTours.find(
    (tour) => tour.tour === currentTour,
  )?.steps as ContextualTourStep[] | undefined;
  const activeSteps = configuredSteps?.filter(
    (candidate) =>
      !candidate.optional ||
      !candidate.selector ||
      selectorExists(candidate.selector),
  );
  const activeStepIndex =
    activeSteps?.findIndex(
      (candidate) =>
        candidate === safeStep ||
        (candidate.title === safeStep.title &&
          candidate.selector === safeStep.selector),
    ) ?? -1;
  const displayedStep =
    activeStepIndex >= 0 ? activeStepIndex + 1 : currentStep + 1;
  const displayedTotal = activeSteps?.length || totalSteps;
  const isDisplayedLast = displayedStep === displayedTotal;
  const progressPct = Math.round((displayedStep / displayedTotal) * 100);
  const requiresInteraction = Boolean(safeStep.interactionSelector);
  const teachesStudyOrb =
    safeStep.interactionSelector === "[data-tour='study-guidance-orb']";
  const previousRenderedStep =
    activeStepIndex > 0 ? activeSteps?.[activeStepIndex - 1] : undefined;
  const previousRenderedStepIndex = previousRenderedStep
    ? configuredSteps?.indexOf(previousRenderedStep)
    : undefined;
  const nextRenderedStep =
    activeStepIndex >= 0 ? activeSteps?.[activeStepIndex + 1] : undefined;
  const nextRenderedStepIndex = nextRenderedStep
    ? configuredSteps?.indexOf(nextRenderedStep)
    : undefined;

  const goBack = () => {
    if (
      previousRenderedStepIndex !== undefined &&
      previousRenderedStepIndex >= 0 &&
      previousRenderedStepIndex !== currentStep - 1
    ) {
      setCurrentStep(previousRenderedStepIndex);
      return;
    }
    prevStep();
  };

  const goNext = () => {
    if (
      nextRenderedStepIndex !== undefined &&
      nextRenderedStepIndex >= 0 &&
      nextRenderedStepIndex !== currentStep + 1
    ) {
      setCurrentStep(nextRenderedStepIndex);
      return;
    }
    nextStep();
  };

  const postpone = () => {
    if (isDisplayedLast) {
      nextStep();
      return;
    }
    if (!isQuestionEngineTour) {
      closeNextStep();
      return;
    }
    setSkipConfirmationOpen(true);
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
          skipConfirmationOpen && "pointer-events-none",
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
                Step {displayedStep} of {displayedTotal}
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
              aria-label={
                isDisplayedLast
                  ? "Finish tutorial"
                  : isQuestionEngineTour
                    ? "Exit tutorial"
                    : "Not now"
              }
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

          {tutorialFeedback?.step === currentStep &&
          tutorialFeedback.tour === currentTour ? (
            <div
              key={`${tutorialFeedback.title}-${tutorialFeedback.description}`}
              className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.08] px-3.5 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
              role="status"
              aria-live="polite"
            >
              <p className="font-semibold text-primary">
                {tutorialFeedback.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-card-foreground/85">
                {tutorialFeedback.description}
              </p>
            </div>
          ) : null}

          <div
            className="sr-only"
            role="progressbar"
            aria-label="Tutorial progress"
            aria-valuemin={0}
            aria-valuemax={displayedTotal}
            aria-valuenow={displayedStep}
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
            {safeStep.showSkip && skipTour ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSkipConfirmationOpen(true)}
              >
                Skip tutorial
              </Button>
            ) : (
              <span />
            )}

            {safeStep.showControls ? (
              <div className="ml-auto flex items-center gap-2">
                {!isFirst && !safeStep.hideBack ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={goNext}
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
      {skipConfirmationOpen ? (
        <div
          data-tutorial-confirmation-overlay
          className="pointer-events-auto fixed inset-0 z-[1390] bg-black/70"
          aria-hidden
        />
      ) : null}
      <AlertDialog
        open={skipConfirmationOpen}
        onOpenChange={setSkipConfirmationOpen}
      >
        <AlertDialogContent className="z-[1400]">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip this tutorial?</AlertDialogTitle>
            <AlertDialogDescription>
              {isQuestionEngineTour
                ? "You can replay it later from Settings. Your intended attempt will begin after you skip."
                : "You can replay it later from Settings."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => skipTour?.()}>
              {isQuestionEngineTour ? "Skip and continue" : "Skip tutorial"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>,
    document.body,
  );
}
