'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useNextStep } from 'nextstepjs';
import { useAuth } from '@/features/auth';
import {
  getFirstSelectorForTour,
  getTourForPathname,
} from '@/features/onboarding/config/tour-steps';
import { consumeOnboardingAutoStartSuppression } from '@/features/onboarding/lib/suppress-next-auto-tour';
import { useOnboardingProgress } from '@/features/onboarding/hooks/use-onboarding-progress';
import { STUDENT_WELCOME_TOUR } from '@/features/welcome/lib/onboarding';

/**
 * Mounts inside `OnboardingProvider` and auto-starts the appropriate tour
 * for the current pathname (see `getTourForPathname`). Tour completion is
 * persisted per-tour in `students.onboarding_progress`.
 *
 * Waits until the full-screen welcome wizard (`student-welcome`) is completed
 * so the wizard and spotlight tours do not overlap.
 *
 * Mobile users are skipped because sidebar tour anchors are hidden behind the
 * mobile menu; they can replay any tour manually from Settings.
 */
export function OnboardingAutoStart() {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isProgressLoading, isCompleted } = useOnboardingProgress();
  const pathname = usePathname();
  const lastStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !session) return;
    if (isProgressLoading) return;
    if (isNextStepVisible) return;
    // Keep spotlight tours behind the welcome wizard until it is acknowledged.
    if (!isCompleted(STUDENT_WELCOME_TOUR)) return;

    const tourId = getTourForPathname(pathname);
    if (!tourId) return;
    if (consumeOnboardingAutoStartSuppression(tourId)) {
      lastStartedRef.current = tourId;
      return;
    }
    if (lastStartedRef.current === tourId) return;
    if (isCompleted(tourId)) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;

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
    session,
    isProgressLoading,
    pathname,
    isNextStepVisible,
    startNextStep,
    isCompleted,
  ]);

  return null;
}
