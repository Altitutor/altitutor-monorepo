"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import { getTourForPathname } from "@/features/onboarding/config/tour-steps";
import { onboardingStorage } from "@/features/onboarding/lib/storage";

/**
 * Mounts inside `OnboardingProvider` and auto-starts the appropriate tour
 * for the current pathname (see `getTourForPathname`). Tour completion is
 * persisted per-tour, so each feature's intro shows at most once.
 *
 * Mobile users are skipped because some tour anchors (the sidebar nav, in
 * particular) are hidden behind a hamburger menu; they can replay any tour
 * manually from Settings.
 */
export function OnboardingAutoStart() {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  // Tracks the last tour we started in this mount so we don't re-trigger on
  // re-renders. Pathname changes overwrite it, which is what we want.
  const lastStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;
    if (isNextStepVisible) return;

    const tourId = getTourForPathname(pathname);
    if (!tourId) return;
    if (lastStartedRef.current === tourId) return;
    if (onboardingStorage.isCompleted(tourId)) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    lastStartedRef.current = tourId;
    const timer = window.setTimeout(() => {
      startNextStep(tourId);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [isLoading, user, pathname, isNextStepVisible, startNextStep]);

  return null;
}
