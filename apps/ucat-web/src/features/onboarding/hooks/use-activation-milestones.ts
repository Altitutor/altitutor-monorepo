"use client";

import { useEffect, useRef } from "react";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_FIRST_RESULT_REVIEWED } from "@/features/onboarding/lib/activation-milestones";

export function useMarkFirstResultReviewed(ready: boolean) {
  const completeMilestone = useCompleteOnboardingTour();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    completeMilestone.mutate(UCAT_FIRST_RESULT_REVIEWED);
  }, [completeMilestone, ready]);
}
