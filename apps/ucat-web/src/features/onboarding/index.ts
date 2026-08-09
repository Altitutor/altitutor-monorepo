export { OnboardingProvider } from "@/features/onboarding/components/onboarding-provider";
export { OnboardingAutoStart } from "@/features/onboarding/components/onboarding-auto-start";
export { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
export { useOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-tour";
export {
  useOnboardingProgress,
  useCompleteOnboardingTour,
  useResetAllOnboardingTours,
  useResetOnboardingTour,
} from "@/features/onboarding/hooks/use-onboarding-progress";
export {
  buildQuestionEngineTutorialHref,
  isQuestionEnginePath,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";
export { useQuestionEngineTutorialGate } from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
export {
  ALL_UCAT_TOUR_IDS,
  UCAT_DASHBOARD_TOUR,
  UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
  UCAT_LEARN_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SETS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_STUDY_PLAN_TOUR,
  UCAT_TOUR_REPLAY_OPTIONS,
  getAutoStartTourForPathname,
  getFirstSelectorForTour,
} from "@/features/onboarding/config/tour-steps";
