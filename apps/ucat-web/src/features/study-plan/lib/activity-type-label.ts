import type {
  StudyGuidanceItem,
  StudyPlanTask,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

type ActivityLabelInput = Pick<
  StudyPlanTask,
  | "taskType"
  | "launchConfig"
  | "mockId"
  | "questionSetId"
  | "questionStemCategoryId"
> &
  Partial<Pick<StudyGuidanceItem, "sourceAttemptType">>;

function hasFilters(item: ActivityLabelInput): boolean {
  const categoryIds = item.launchConfig.categoryIds;
  const questionTagIds = item.launchConfig.questionTagIds;
  return (
    item.launchConfig.sourcePracticeScope === "targeted" ||
    item.questionStemCategoryId != null ||
    (Array.isArray(categoryIds) && categoryIds.length > 0) ||
    (Array.isArray(questionTagIds) && questionTagIds.length > 0)
  );
}

function baseActivityTypeLabel(
  taskType: StudyPlanTaskType,
  item?: ActivityLabelInput,
): string {
  if (taskType === "learn") return "Learning module";
  if (taskType === "skill_trainer") return "Skill trainer";
  if (taskType === "section_benchmark") return "Set";
  if (taskType === "mock") return "Mock";
  return item && hasFilters(item) ? "Targeted practice" : "Broad practice";
}

function reviewSourceType(
  item: ActivityLabelInput,
  sourceTask?: ActivityLabelInput | null,
): ActivityLabelInput {
  if (sourceTask) {
    return sourceTask;
  }

  const sourceActivityType = item.launchConfig.sourceActivityType;
  const attemptType = item.sourceAttemptType ?? sourceActivityType;
  if (attemptType === "mock_attempt" || item.mockId)
    return { ...item, taskType: "mock" };
  if (attemptType === "set_attempt" || item.questionSetId)
    return { ...item, taskType: "section_benchmark" };
  return { ...item, taskType: "practice" };
}

/** Human-readable activity kind shown above Study plan activity titles. */
export function studyPlanActivityTypeLabel(
  item: ActivityLabelInput,
  sourceTask?: ActivityLabelInput | null,
): string {
  if (item.taskType !== "review")
    return baseActivityTypeLabel(item.taskType, item);
  const source = reviewSourceType(item, sourceTask);
  return `Review of ${baseActivityTypeLabel(source.taskType, source).toLowerCase()}`;
}
