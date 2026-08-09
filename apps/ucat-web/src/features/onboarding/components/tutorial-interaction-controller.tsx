"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-catalog";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";

const OPTIONAL_TARGET_WAIT_MS = 120;

function closestActionable(target: Element): HTMLElement | null {
  return target.closest<HTMLElement>(
    "a,button,input,select,textarea,[role='button']",
  );
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

      const nextStep = getTourStep(currentTour, currentStep + 1);
      if (nextStep) {
        transitionLockedRef.current = true;
        setCurrentStep(currentStep + 1);
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
    setCurrentStep,
  ]);

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
      if (currentTour !== UCAT_QUESTION_ENGINE_TOUR) {
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
      if (!confirmed) return;
      void completeTour
        .mutateAsync(currentTour)
        .catch(() => undefined)
        .then(closeNextStep);
    };
    window.addEventListener("keydown", postpone, true);
    return () => window.removeEventListener("keydown", postpone, true);
  }, [closeNextStep, completeTour, currentTour, isNextStepVisible]);

  return null;
}
