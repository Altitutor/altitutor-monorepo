"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNextStep } from "nextstepjs";
import {
  getFirstSelectorForTour,
  UCAT_DASHBOARD_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { suppressNextOnboardingAutoStart } from "@/features/onboarding/lib/suppress-next-auto-tour";
import { beginTutorialReplay } from "@/features/onboarding/lib/tutorial-replay";

const REPLAY_START_MS = 520;

/**
 * Imperative controls for the UCAT onboarding tours.
 *
 * - `startTour(tourId?)` immediately starts the given tour (defaults to the
 *   welcome tour) without touching persistence.
 * - `replayTour(tourId)` preserves completion, navigates to the page where its
 *   anchors exist, then starts it (used from Settings).
 */
export function useOnboardingTour() {
  const { startNextStep, closeNextStep } = useNextStep();
  const router = useRouter();

  const startTour = useCallback(
    (tourId: string = UCAT_DASHBOARD_TOUR) => {
      startNextStep(tourId);
    },
    [startNextStep],
  );

  const replayTour = useCallback(
    (tourId: string, href: string, returnTo = "/settings/app") => {
      beginTutorialReplay({ tourId, returnTo });
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
    [router, startNextStep],
  );

  return {
    startTour,
    replayTour,
    closeTour: closeNextStep,
  };
}
