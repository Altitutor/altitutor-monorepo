"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import { getAutoStartTourEntryForPathname } from "@/features/onboarding/config/tour-catalog";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { consumeOnboardingAutoStartSuppression } from "@/features/onboarding/lib/suppress-next-auto-tour";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  consumeTutorialResume,
  readTutorialResume,
} from "@/features/onboarding/lib/tutorial-resume";

/**
 * Starts an incomplete contextual app tutorial once its first target exists.
 * Completion is persisted per tutorial, so each revised tutorial launches at
 * most once across devices unless the student explicitly replays it.
 */
export function OnboardingAutoStart() {
  const { startNextStep, setCurrentStep, isNextStepVisible } = useNextStep();
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    isLoading: isProgressLoading,
    isError: isProgressError,
    isCompleted,
  } = useOnboardingProgress();
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
    if (isProgressError) return;
    if (isNextStepVisible) return;

    const routeEntry = getAutoStartTourEntryForPathname(pathname);
    if (!routeEntry) return;
    const { tourId, startStep } = routeEntry;
    if (consumeOnboardingAutoStartSuppression(tourId)) {
      lastStartedRef.current = tourId;
      return;
    }
    if (lastStartedRef.current === tourId) return;
    if (isCompleted(tourId)) return;
    lastStartedRef.current = tourId;
    const matchingPause = readTutorialResume(tourId, pathname);
    const resume =
      matchingPause && getTourStep(tourId, matchingPause.stepIndex)
        ? matchingPause
        : null;
    const initialStep = resume?.stepIndex ?? startStep;
    const targetSelector = getTourStep(tourId, initialStep)?.selector;
    let attempts = 0;
    let timer: number;

    const startWhenReady = () => {
      if (!targetSelector || document.querySelector(targetSelector)) {
        startNextStep(tourId);
        if (initialStep > 0) {
          setCurrentStep(initialStep);
        }
        if (resume) {
          consumeTutorialResume(tourId, pathname);
        }
        return;
      }
      attempts += 1;
      if (attempts < 50) {
        timer = window.setTimeout(startWhenReady, 100);
      }
    };

    timer = window.setTimeout(startWhenReady, 0);

    return () => window.clearTimeout(timer);
  }, [
    isAuthLoading,
    user,
    isProgressLoading,
    isProgressError,
    pathname,
    isNextStepVisible,
    startNextStep,
    setCurrentStep,
    isCompleted,
  ]);

  return null;
}
