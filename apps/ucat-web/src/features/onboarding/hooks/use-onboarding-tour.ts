"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNextStep } from "nextstepjs";
import {
  getFirstSelectorForTour,
  UCAT_ONBOARDING_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { useResetOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { suppressNextOnboardingAutoStart } from "@/features/onboarding/lib/suppress-next-auto-tour";

const REPLAY_START_MS = 520;

/**
 * Imperative controls for the UCAT onboarding tours.
 *
 * - `startTour(tourId?)` immediately starts the given tour (defaults to the
 *   welcome tour) without touching persistence.
 * - `replayTour(tourId)` clears that tour's completion, navigates to the page
 *   where its anchors exist, then starts it (used from Settings).
 */
export function useOnboardingTour() {
  const { startNextStep, closeNextStep } = useNextStep();
  const router = useRouter();
  const resetTour = useResetOnboardingTour();

  const startTour = useCallback(
    (tourId: string = UCAT_ONBOARDING_TOUR) => {
      startNextStep(tourId);
    },
    [startNextStep],
  );

  const replayTour = useCallback(
    async (tourId: string, href: string) => {
      try {
        await resetTour.mutateAsync(tourId);
      } catch {
        // Best-effort: still navigate and play; persistence may catch up later.
      }
      suppressNextOnboardingAutoStart(tourId);
      router.push(href);
      const firstSelector = getFirstSelectorForTour(tourId);
      let attempts = 0;
      const startWhenReady = () => {
        if (!firstSelector || document.querySelector(firstSelector)) {
          startNextStep(tourId);
          return;
        }
        attempts += 1;
        if (attempts < 50) window.setTimeout(startWhenReady, 100);
      };
      window.setTimeout(startWhenReady, REPLAY_START_MS);
    },
    [resetTour, router, startNextStep],
  );

  return {
    startTour,
    replayTour,
    closeTour: closeNextStep,
    isResetting: resetTour.isPending,
  };
}
