"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import {
  getFirstSelectorForTour,
  getTourForPathname,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { consumeOnboardingAutoStartSuppression } from "@/features/onboarding/lib/suppress-next-auto-tour";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

/**
 * Starts only the explicit question-engine tutorial route. Page and dashboard
 * tours are replayable from Settings but never launch automatically.
 */
export function OnboardingAutoStart() {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isProgressLoading, isCompleted } = useOnboardingProgress();
  const pathname = usePathname();
  // Tracks the last tour we started in this mount so we don't re-trigger on
  // re-renders. Pathname changes overwrite it, which is what we want.
  const lastStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (isProgressLoading) return;
    if (isNextStepVisible) return;

    const tourId = getTourForPathname(pathname);
    if (tourId !== UCAT_QUESTION_ENGINE_TOUR) return;
    if (consumeOnboardingAutoStartSuppression(tourId)) {
      lastStartedRef.current = tourId;
      return;
    }
    if (lastStartedRef.current === tourId) return;
    if (isCompleted(tourId)) return;
    lastStartedRef.current = tourId;
    const firstSelector = getFirstSelectorForTour(tourId);
    let attempts = 0;
    let timer: number;

    const startWhenReady = () => {
      if (!firstSelector || document.querySelector(firstSelector)) {
        startNextStep(tourId);
        return;
      }
      attempts += 1;
      if (attempts < 50) {
        timer = window.setTimeout(startWhenReady, 100);
      }
    };

    timer = window.setTimeout(startWhenReady, 600);

    return () => window.clearTimeout(timer);
  }, [
    isAuthLoading,
    user,
    isProgressLoading,
    pathname,
    isNextStepVisible,
    startNextStep,
    isCompleted,
  ]);

  return null;
}
