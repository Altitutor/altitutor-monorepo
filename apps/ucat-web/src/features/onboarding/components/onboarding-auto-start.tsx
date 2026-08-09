"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import { getAutoStartTourForPathname } from "@/features/onboarding/config/tour-catalog";
import { getFirstSelectorForTour } from "@/features/onboarding/config/tour-steps";
import { consumeOnboardingAutoStartSuppression } from "@/features/onboarding/lib/suppress-next-auto-tour";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

/**
 * Starts an incomplete contextual app tutorial once its first target exists.
 * Completion is persisted per tutorial, so each revised tutorial launches at
 * most once across devices unless the student explicitly replays it.
 */
export function OnboardingAutoStart() {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isProgressLoading, isCompleted } = useOnboardingProgress();
  const pathname = usePathname();
  // Tracks the last tour we started in this mount so we don't re-trigger on
  // re-renders. Pathname changes overwrite it, which is what we want.
  const lastStartedRef = useRef<string | null>(null);
  const lastPathnameRef = useRef(pathname);

  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      lastStartedRef.current = null;
    }
    if (isAuthLoading || !user) return;
    if (isProgressLoading) return;
    if (isNextStepVisible) return;

    const tourId = getAutoStartTourForPathname(pathname);
    if (!tourId) return;
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
