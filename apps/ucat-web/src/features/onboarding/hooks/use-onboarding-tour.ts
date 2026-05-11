"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNextStep } from "nextstepjs";
import {
  ALL_UCAT_TOUR_IDS,
  UCAT_ONBOARDING_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { onboardingStorage } from "@/features/onboarding/lib/storage";

/**
 * Imperative controls for the UCAT onboarding tours.
 *
 * - `startTour(tourId?)` immediately starts the given tour (defaults to the
 *   welcome tour) without touching persistence.
 * - `restartTour()` clears the welcome tour's completion flag, routes to the
 *   dashboard (where all welcome anchors are reliably present) and starts it.
 * - `resetAllTours()` clears every known tour's completion flag, so each
 *   feature tour will auto-start again on its next first visit.
 */
export function useOnboardingTour() {
  const { startNextStep, closeNextStep } = useNextStep();
  const router = useRouter();

  const startTour = useCallback(
    (tourId: string = UCAT_ONBOARDING_TOUR) => {
      startNextStep(tourId);
    },
    [startNextStep],
  );

  const restartTour = useCallback(() => {
    onboardingStorage.reset(UCAT_ONBOARDING_TOUR);
    router.push("/dashboard");
    // Allow navigation + paint to settle before starting.
    window.setTimeout(() => {
      startNextStep(UCAT_ONBOARDING_TOUR);
    }, 400);
  }, [router, startNextStep]);

  const resetAllTours = useCallback(() => {
    onboardingStorage.resetAll(ALL_UCAT_TOUR_IDS);
  }, []);

  return {
    startTour,
    restartTour,
    resetAllTours,
    closeTour: closeNextStep,
  };
}
