import type {
  StudyPlanProfileInput,
  StudyPlanResponse,
} from "@/features/study-plan/model/types";

export const DEFAULT_SKIP_GOAL_TARGET_SCORE = 2200;

export function defaultSkippedGoalProfileInput(
  testYear = new Date().getFullYear(),
): StudyPlanProfileInput {
  return {
    studyPlanEnabled: false,
    studySuggestionsEnabled: true,
    targetScore: DEFAULT_SKIP_GOAL_TARGET_SCORE,
    testYear,
    testDate: null,
    availableDays: [],
    preferredMockWeekday: 6,
  };
}

export function hasStudyPlanGoal(
  profile: StudyPlanResponse["profile"] | null | undefined,
): boolean {
  return Boolean(profile?.testYear && profile.targetScore);
}
