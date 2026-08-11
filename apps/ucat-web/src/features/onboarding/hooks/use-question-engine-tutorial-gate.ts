"use client";

import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  getQuestionEngineTutorialKind,
  isQuestionEngineTutorialSatisfied,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";

export {
  buildQuestionEngineTutorialHref,
  isQuestionEnginePath,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";

/**
 * Gates real question-engine routes behind the one-time engine tutorial.
 * While loading, treat as not ready so callers do not create attempts/sessions.
 */
export function useQuestionEngineTutorialGate() {
  const progress = useOnboardingProgress();
  const profile = useUcatProfile();
  const tutorialKind = getQuestionEngineTutorialKind(
    profile.data?.ucatInitialFamiliarity,
  );
  const isLoading = progress.isLoading || profile.isLoading;
  const isBlocked =
    !isLoading &&
    !isQuestionEngineTutorialSatisfied(tutorialKind, progress.isCompleted);

  return {
    isLoading,
    isBlocked,
    tutorialKind,
    /** True once we know the user may enter a real engine route. */
    isReady: !isLoading && !isBlocked,
  };
}
