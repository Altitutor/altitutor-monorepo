"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import {
  getTourForPathname,
  UCAT_ONBOARDING_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { consumeOnboardingAutoStartSuppression } from "@/features/onboarding/lib/suppress-next-auto-tour";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { consumeSignupOnboardingTourPending } from "@/features/signup-onboarding/lib/signup-tour-flag";

/**
 * Mounts inside `OnboardingProvider` and auto-starts the appropriate tour
 * for the current pathname (see `getTourForPathname`). Tour completion is
 * persisted per-tour in `students.onboarding_progress`, so each feature's
 * intro shows at most once across all devices.
 *
 * Mobile users are skipped because some tour anchors (the sidebar nav, in
 * particular) are hidden behind a hamburger menu; they can replay any tour
 * manually from Settings.
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
    if (!tourId) return;
    if (
      tourId === UCAT_ONBOARDING_TOUR &&
      consumeSignupOnboardingTourPending()
    ) {
      lastStartedRef.current = tourId;
      const timer = window.setTimeout(() => {
        startNextStep(tourId);
      }, 600);
      return () => window.clearTimeout(timer);
    }
    if (consumeOnboardingAutoStartSuppression(tourId)) {
      lastStartedRef.current = tourId;
      return;
    }
    if (lastStartedRef.current === tourId) return;
    if (isCompleted(tourId)) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    lastStartedRef.current = tourId;
    const timer = window.setTimeout(() => {
      startNextStep(tourId);
    }, 600);

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
