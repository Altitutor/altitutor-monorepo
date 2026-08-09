import type {
  StudyGuidanceItem,
  StudyPlanTask,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

type ActivityLabelInput = Pick<
  StudyPlanTask,
  "taskType" | "launchConfig" | "mockId" | "questionSetId"
> &
  Partial<Pick<StudyGuidanceItem, "sourceAttemptType">>;

function baseActivityTypeLabel(taskType: StudyPlanTaskType): string {
  if (taskType === "learn") return "Learning module";
  if (taskType === "skill_trainer") return "Skill trainer";
  if (taskType === "section_benchmark") return "Set";
  if (taskType === "mock") return "Mock";
  return "Practice questions";
}

function reviewSourceType(
  item: ActivityLabelInput,
  sourceTask?: Pick<StudyPlanTask, "taskType"> | null,
): Exclude<StudyPlanTaskType, "review" | "learn" | "skill_trainer"> {
  if (sourceTask) {
    if (sourceTask.taskType === "mock") return "mock";
    if (sourceTask.taskType === "section_benchmark") return "section_benchmark";
    return "practice";
  }

  const sourceActivityType = item.launchConfig.sourceActivityType;
  const attemptType = item.sourceAttemptType ?? sourceActivityType;
  if (attemptType === "mock_attempt" || item.mockId) return "mock";
  if (attemptType === "set_attempt" || item.questionSetId)
    return "section_benchmark";
  return "practice";
}

/** Human-readable activity kind shown above Study plan activity titles. */
export function studyPlanActivityTypeLabel(
  item: ActivityLabelInput,
  sourceTask?: Pick<StudyPlanTask, "taskType"> | null,
): string {
  if (item.taskType !== "review") return baseActivityTypeLabel(item.taskType);
  return `Review of ${baseActivityTypeLabel(reviewSourceType(item, sourceTask)).toLowerCase()}`;
}
