import type { StudyPlanTask } from "@/features/study-plan/model/types";

function byPlanOrder(left: StudyPlanTask, right: StudyPlanTask): number {
  return (
    left.scheduledDate.localeCompare(right.scheduledDate) ||
    left.sortOrder - right.sortOrder
  );
}

export function isStudyPlanTaskActionable(task: StudyPlanTask): boolean {
  if (task.status === "completed" || task.status === "skipped") return false;
  if (task.taskType !== "review") return true;
  return task.launchConfig.awaitingAttempt === false;
}

export function selectNextStudyPlanTask(
  tasks: StudyPlanTask[],
): StudyPlanTask | null {
  const ordered = [...tasks].sort(byPlanOrder);
  return (
    ordered.find(
      (task) =>
        (task.status === "in_progress" || task.status === "partial") &&
        isStudyPlanTaskActionable(task),
    ) ??
    ordered.find(
      (task) => task.status === "planned" && isStudyPlanTaskActionable(task),
    ) ??
    null
  );
}

export function isCarryOverStudyPlanTask(
  task: StudyPlanTask,
  today: string,
): boolean {
  return (
    task.scheduledDate < today &&
    task.status !== "completed" &&
    task.status !== "skipped"
  );
}

/** Tasks that should be dealt with before offering optional extra study. */
export function selectCurrentStudyPlanTasks(
  tasks: StudyPlanTask[],
  today: string,
): StudyPlanTask[] {
  return [...tasks]
    .filter(
      (task) =>
        task.scheduledDate === today || isCarryOverStudyPlanTask(task, today),
    )
    .sort(byPlanOrder);
}

export function getTodayStudyPlanProgress(tasks: StudyPlanTask[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const included = tasks.filter((task) => task.status !== "skipped");
  const completed = included.filter(
    (task) => task.status === "completed",
  ).length;
  return {
    completed,
    total: included.length,
    percent: included.length
      ? Math.round((completed / included.length) * 100)
      : 0,
  };
}

export function findNextStudyDate(
  tasks: StudyPlanTask[],
  today: string,
): string | null {
  return (
    [...tasks]
      .sort(byPlanOrder)
      .find((task) => task.scheduledDate > today && task.status !== "skipped")
      ?.scheduledDate ?? null
  );
}

export function findNewlyCompletedTask(
  previousStatuses: Map<string, StudyPlanTask["status"]>,
  currentTasks: StudyPlanTask[],
): StudyPlanTask | null {
  return (
    [...currentTasks]
      .filter(
        (task) =>
          task.status === "completed" &&
          previousStatuses.has(task.id) &&
          previousStatuses.get(task.id) !== "completed",
      )
      .sort((left, right) => {
        const leftTime = left.completedAt
          ? new Date(left.completedAt).getTime()
          : 0;
        const rightTime = right.completedAt
          ? new Date(right.completedAt).getTime()
          : 0;
        return rightTime - leftTime || byPlanOrder(right, left);
      })[0] ?? null
  );
}

export function mapStudyPlanTaskStatuses(
  tasks: StudyPlanTask[],
): Map<string, StudyPlanTask["status"]> {
  return new Map(tasks.map((task) => [task.id, task.status]));
}
