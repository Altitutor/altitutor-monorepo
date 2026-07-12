"use client";

import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

export {
  buildQuestionEngineTutorialHref,
  isQuestionEnginePath,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";

/**
 * Gates real question-engine routes behind the one-time engine tutorial.
 * While loading, treat as not ready so callers do not create attempts/sessions.
 */
export function useQuestionEngineTutorialGate() {
  const { isLoading, isCompleted } = useOnboardingProgress();
  const isBlocked = !isLoading && !isCompleted(UCAT_QUESTION_ENGINE_TOUR);

  return {
    isLoading,
    isBlocked,
    /** True once we know the user may enter a real engine route. */
    isReady: !isLoading && !isBlocked,
  };
}
