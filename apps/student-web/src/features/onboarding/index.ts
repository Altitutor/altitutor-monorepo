export { OnboardingProvider } from '@/features/onboarding/components/onboarding-provider';
export { OnboardingAutoStart } from '@/features/onboarding/components/onboarding-auto-start';
export { OnboardingCard } from '@/features/onboarding/components/onboarding-card';
export { useOnboardingTour } from '@/features/onboarding/hooks/use-onboarding-tour';
export {
  ONBOARDING_QUERY_KEY,
  useOnboardingProgress,
  useCompleteOnboardingTour,
  useResetOnboardingTour,
} from '@/features/onboarding/hooks/use-onboarding-progress';
export {
  ALL_STUDENT_TOUR_IDS,
  STUDENT_NEXTSTEP_FIXED_VIEWPORT_ID,
  STUDENT_BILLING_TOUR,
  STUDENT_CLASSES_TOUR,
  STUDENT_FLASHCARDS_TOUR,
  STUDENT_PORTAL_TOUR,
  STUDENT_RESOURCES_TOUR,
  STUDENT_TOUR_REPLAY_OPTIONS,
  getFirstSelectorForTour,
  getNavTourAttr,
  getTourForPathname,
} from '@/features/onboarding/config/tour-steps';
