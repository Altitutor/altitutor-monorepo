"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  clearTutorialResume,
  readTutorialResume,
  saveTutorialResume,
} from "@/features/onboarding/lib/tutorial-resume";

const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

function isInsideTutorialSurface(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "[data-name='nextstep-card'], [data-slot='alert-dialog-content']",
    ) != null
  );
}

function acceptsTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

/** Coordinates page-level behavior that nextstepjs does not own. */
export function TutorialLifecycleController() {
  const pathname = usePathname();
  const { currentStep, currentTour, closeNextStep, isNextStepVisible } =
    useNextStep();
  const completeTour = useCompleteOnboardingTour();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (previousPathname === pathname || !isNextStepVisible || !currentTour) {
      return;
    }

    const existingHandoff = readTutorialResume(currentTour, pathname);
    if (
      existingHandoff?.tourId !== currentTour ||
      existingHandoff.pathname !== pathname
    ) {
      const nextStepIndex = currentStep + 1;
      if (getTourStep(currentTour, nextStepIndex)) {
        saveTutorialResume({
          tourId: currentTour,
          stepIndex: nextStepIndex,
          pathname: previousPathname,
        });
      } else {
        clearTutorialResume(currentTour);
        completeTour.mutate(currentTour);
      }
    }

    closeNextStep();
  }, [
    closeNextStep,
    completeTour,
    currentStep,
    currentTour,
    isNextStepVisible,
    pathname,
  ]);

  useEffect(() => {
    if (!isNextStepVisible) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const preventPointerScroll = (event: Event) => {
      if (!isInsideTutorialSurface(event.target)) event.preventDefault();
    };
    const preventKeyboardScroll = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return;
      if (
        isInsideTutorialSurface(event.target) ||
        acceptsTextInput(event.target)
      ) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("wheel", preventPointerScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchmove", preventPointerScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener("keydown", preventKeyboardScroll, true);

    return () => {
      window.removeEventListener("wheel", preventPointerScroll, true);
      window.removeEventListener("touchmove", preventPointerScroll, true);
      window.removeEventListener("keydown", preventKeyboardScroll, true);
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, [isNextStepVisible]);

  return null;
}
