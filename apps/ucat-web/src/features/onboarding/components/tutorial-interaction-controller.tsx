"use client";

import { useCallback, useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import {
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-catalog";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  clearTutorialResume,
  handoffTutorialToPath,
} from "@/features/onboarding/lib/tutorial-resume";
import { requestTutorialSkipConfirmation } from "@/features/onboarding/lib/tutorial-events";

const OPTIONAL_TARGET_WAIT_MS = 120;

function closestActionable(target: Element): HTMLElement | null {
  return target.closest<HTMLElement>(
    "a,button,input,select,textarea,[role='button']",
  );
}

function outboundPathname(actionable: HTMLElement | null): string | null {
  if (!(actionable instanceof HTMLAnchorElement)) return null;
  const destination = new URL(actionable.href, window.location.href);
  if (destination.origin !== window.location.origin) return null;
  return destination.pathname !== window.location.pathname
    ? destination.pathname
    : null;
}

function repaintTutorialSpotlight() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  });
}

/**
 * Lets a contextual tutorial require a real highlighted control. Final clicks
 * are replayed only after completion is persisted, so route navigation cannot
 * discard the write.
 */
export function TutorialInteractionController() {
  const {
    currentTour,
    currentStep,
    setCurrentStep,
    closeNextStep,
    isNextStepVisible,
  } = useNextStep();
  const completeTour = useCompleteOnboardingTour();
  const replayingClickRef = useRef(false);
  const transitionLockedRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);

  const scheduleStepChange = useCallback(
    (stepIndex: number, delayMs?: number) => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (!delayMs) {
        setCurrentStep(stepIndex);
        repaintTutorialSpotlight();
        return;
      }
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        setCurrentStep(stepIndex);
        repaintTutorialSpotlight();
      }, delayMs);
    },
    [setCurrentStep],
  );

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (isNextStepVisible || transitionTimerRef.current === null) return;
    window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
  }, [isNextStepVisible]);

  useEffect(() => {
    transitionLockedRef.current = false;
    if (!isNextStepVisible || !currentTour) return;
    const step = getTourStep(currentTour, currentStep);
    if (!step?.interactionSelector) return;
    const interactionSelector = step.interactionSelector;

    const handleClick = (event: MouseEvent) => {
      if (replayingClickRef.current) return;
      const eventTarget = event.target;
      if (!(eventTarget instanceof Element)) return;
      const interactionTarget = eventTarget.closest(interactionSelector);
      if (!interactionTarget || transitionLockedRef.current) return;

      const nextStep = step.completeOnInteraction
        ? null
        : getTourStep(currentTour, currentStep + 1);
      if (nextStep) {
        if (step.preventInteractionDefault) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        transitionLockedRef.current = true;
        const actionable = closestActionable(interactionTarget);
        const destinationPathname = outboundPathname(actionable);
        if (destinationPathname) {
          handoffTutorialToPath({
            tourId: currentTour,
            stepIndex: currentStep + 1,
            pathname: destinationPathname,
          });
          closeNextStep();
          return;
        }
        if (step.interactionAdvanceDelayMs) {
          scheduleStepChange(currentStep + 1, step.interactionAdvanceDelayMs);
          return;
        }
        scheduleStepChange(currentStep + 1);
        return;
      }

      const actionable = closestActionable(interactionTarget);
      if (!actionable) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      transitionLockedRef.current = true;

      void completeTour
        .mutateAsync(currentTour)
        .catch(() => undefined)
        .then(() => {
          clearTutorialResume(currentTour);
          closeNextStep();
          replayingClickRef.current = true;
          actionable.click();
          queueMicrotask(() => {
            replayingClickRef.current = false;
          });
        });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [
    closeNextStep,
    completeTour,
    currentStep,
    currentTour,
    isNextStepVisible,
    scheduleStepChange,
    setCurrentStep,
  ]);

  useEffect(() => {
    if (!isNextStepVisible || !currentTour) return;
    const step = getTourStep(currentTour, currentStep);
    if (!step?.backInteractionSelector) return;
    const backInteractionSelector = step.backInteractionSelector;

    const handleBackInteraction = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (
        eventTarget instanceof Element &&
        eventTarget.closest(backInteractionSelector)
      ) {
        scheduleStepChange(
          Math.max(0, currentStep - 1),
          step.backInteractionAdvanceDelayMs,
        );
      }
    };

    document.addEventListener("click", handleBackInteraction, true);
    return () =>
      document.removeEventListener("click", handleBackInteraction, true);
  }, [currentStep, currentTour, isNextStepVisible, scheduleStepChange]);

  useEffect(() => {
    if (!isNextStepVisible || !currentTour) return;
    const step = getTourStep(currentTour, currentStep);
    const scrollSelector = step?.scrollSelector;
    const scrollMode = step?.scrollMode;
    if (scrollMode === "page-start") {
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>("[data-ucat-app-scroll='main']")
            ?.scrollTo({ top: 0, behavior: "auto" });
          window.scrollTo({ top: 0, behavior: "auto" });
        });
      });

      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }
    if (!scrollSelector) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document.querySelector(scrollSelector)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [currentStep, currentTour, isNextStepVisible]);

  useEffect(() => {
    if (!isNextStepVisible || !currentTour) return;
    const step = getTourStep(currentTour, currentStep);
    if (!step?.optional || !step.selector) return;
    const selector = step.selector;
    if (document.querySelector(selector)) return;

    const timer = window.setTimeout(() => {
      if (document.querySelector(selector)) return;
      let nextIndex = currentStep + 1;
      let nextStep = getTourStep(currentTour, nextIndex);
      while (
        nextStep?.optional &&
        nextStep.selector &&
        !document.querySelector(nextStep.selector)
      ) {
        nextIndex += 1;
        nextStep = getTourStep(currentTour, nextIndex);
      }

      if (nextStep) {
        setCurrentStep(nextIndex);
        return;
      }

      void completeTour
        .mutateAsync(currentTour)
        .catch(() => undefined)
        .then(closeNextStep);
    }, OPTIONAL_TARGET_WAIT_MS);

    return () => window.clearTimeout(timer);
  }, [
    closeNextStep,
    completeTour,
    currentStep,
    currentTour,
    isNextStepVisible,
    setCurrentStep,
  ]);

  useEffect(() => {
    if (!isNextStepVisible) return;
    const postpone = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (
        currentTour !== UCAT_QUESTION_ENGINE_TOUR &&
        currentTour !== UCAT_QUESTION_ENGINE_CONTROLS_TOUR
      ) {
        closeNextStep();
        return;
      }
      requestTutorialSkipConfirmation();
    };
    window.addEventListener("keydown", postpone, true);
    return () => window.removeEventListener("keydown", postpone, true);
  }, [closeNextStep, currentTour, isNextStepVisible]);

  return null;
}
