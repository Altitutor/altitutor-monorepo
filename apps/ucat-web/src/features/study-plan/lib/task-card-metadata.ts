import type { StudyPlanTask } from "@/features/study-plan/model/types";

export function visibleTaskPace(task: StudyPlanTask): number | null {
  if (
    (task.taskType !== "practice" && task.taskType !== "section_benchmark") ||
    task.launchConfig.timeMode !== "speed"
  ) {
    return null;
  }

  const pace = task.launchConfig.prescribedPace;
  return typeof pace === "number" && Number.isFinite(pace) ? pace : null;
}
