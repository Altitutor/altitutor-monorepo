import type {
  StudyPlanTask,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

/** Eyebrow + CTA for the orb primary card, derived from the item on screen. */
export function describeCompanionPrimaryChrome(input: {
  taskType: StudyPlanTaskType;
  planTaskStatus?: StudyPlanTask["status"] | null;
  fromEarlierStudyDay?: boolean;
  isAlternative: boolean;
}): { eyebrow: string; primaryLabel: string } {
  if (input.isAlternative || !input.planTaskStatus) {
    return {
      eyebrow:
        input.taskType === "review" ? "Most useful now" : "Best next step",
      primaryLabel: input.taskType === "review" ? "Review result" : "Start",
    };
  }

  return {
    eyebrow: input.fromEarlierStudyDay
      ? "Still to do"
      : input.taskType === "review"
        ? "Most useful now"
        : "Next up",
    primaryLabel:
      input.planTaskStatus === "in_progress" ||
      input.planTaskStatus === "partial"
        ? "Continue task"
        : input.taskType === "review"
          ? "Review result"
          : "Start today’s task",
  };
}
