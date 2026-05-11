"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { UCAT_ONBOARDING_TOUR } from "@/features/onboarding/config/tour-steps";
import {
  useResetAllOnboardingTours,
  useResetOnboardingTour,
} from "@/features/onboarding/hooks/use-onboarding-progress";

/**
 * Imperative controls for the UCAT onboarding tours.
 *
 * - `startTour(tourId?)` immediately starts the given tour (defaults to the
 *   welcome tour) without touching persistence.
 * - `restartTour()` clears the welcome tour's completion in the DB, routes
 *   to the dashboard (where all welcome anchors are reliably present) and
 *   starts it.
 * - `resetAllTours()` clears every tour's completion in the DB so each
 *   feature tour will auto-start again on its next first visit.
 */
export function useOnboardingTour() {
  const { startNextStep, closeNextStep } = useNextStep();
  const router = useRouter();
  const resetTour = useResetOnboardingTour();
  const resetAll = useResetAllOnboardingTours();

  const startTour = useCallback(
    (tourId: string = UCAT_ONBOARDING_TOUR) => {
      startNextStep(tourId);
    },
    [startNextStep],
  );

  const restartTour = useCallback(async () => {
    try {
      await resetTour.mutateAsync(UCAT_ONBOARDING_TOUR);
    } catch {
      // Best-effort: even if the reset fails (e.g. offline), still play
      // the tour; we won't be able to suppress it next visit but UX wins.
    }
    router.push("/dashboard");
    window.setTimeout(() => {
      startNextStep(UCAT_ONBOARDING_TOUR);
    }, 400);
  }, [resetTour, router, startNextStep]);

  const resetAllTours = useCallback(async () => {
    try {
      await resetAll.mutateAsync();
    } catch {
      // Best-effort: feature tours will still show on next visit if the
      // local cache invalidates; the server reset just won't apply.
    }
  }, [resetAll]);

  return {
    startTour,
    restartTour,
    resetAllTours,
    closeTour: closeNextStep,
    isResetting: resetTour.isPending || resetAll.isPending,
  };
}
