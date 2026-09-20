"use client";

import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { getQuestionEngineTutorialKind } from "@/features/onboarding/lib/question-engine-tutorial";

/** Selects the optional dashboard tutorial without gating question attempts. */
export function useQuestionEngineTutorialStatus() {
  const profile = useUcatProfile();

  return {
    isLoading: profile.isLoading,
    tutorialKind: getQuestionEngineTutorialKind(
      profile.data?.ucatInitialFamiliarity,
    ),
  };
}
