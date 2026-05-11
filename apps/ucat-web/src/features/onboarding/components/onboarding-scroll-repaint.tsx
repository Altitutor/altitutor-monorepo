"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { UCAT_PROGRESS_TOUR } from "@/features/onboarding/config/tour-steps";

const PROGRESS_MODE_STEP_INDEX = 1;

/**
 * nextstepjs only recomputes spotlight position on `resize`. Dispatch a
 * synthetic resize on window scroll so highlights stay aligned with targets
 * while the document (or nested scroll containers) moves.
 *
 * Skips this for the progress floating toolbar step: that target is
 * `position: fixed`, so scroll does not move it — firing resize every scroll
 * frame only causes jank and overlay churn.
 */
export function OnboardingScrollRepaint() {
  const { isNextStepVisible, currentTour, currentStep } = useNextStep();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNextStepVisible) return;

    const skipForFixedProgressToolbar =
      currentTour === UCAT_PROGRESS_TOUR &&
      currentStep === PROGRESS_MODE_STEP_INDEX;

    if (skipForFixedProgressToolbar) return;

    const bump = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        window.dispatchEvent(new Event("resize"));
      });
    };

    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", bump, true);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isNextStepVisible, currentTour, currentStep]);

  return null;
}
