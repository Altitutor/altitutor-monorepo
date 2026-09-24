import type { PracticeDiscountDashboardStatus } from "@/lib/ucat/practice-day-discount-dashboard";
import {
  addDays,
  daysBetween,
  parseIsoDate,
} from "@/features/study-plan/lib/dates";
import { findNextStudyDate } from "@/features/study-plan/lib/companion";
import {
  describeStudyNextAction,
  findPrioritySession,
  formatStudyNextActionDate,
  resolveStudyNextAction,
  type StudyNextAction,
  type StudyNextActionContent,
  type StudyNextActionInput,
} from "@/features/study-plan/lib/next-action";
import type { StudyPlanResponse, StudyPlanTask } from "@/features/study-plan/model/types";
import type {
  UcatQuotaArea,
  UcatQuotaAreaUsage,
} from "@/features/ucat-access/types/quota";

/** @deprecated Prefer StudyNextAction from study-plan/lib/next-action */
export type DashboardNextAction = StudyNextAction;

/** @deprecated Prefer StudyNextActionInput from study-plan/lib/next-action */
export type DashboardActionInput = StudyNextActionInput;

export {
  describeStudyNextAction,
  findPrioritySession,
  resolveStudyNextAction,
  type StudyNextAction,
  type StudyNextActionContent,
};

export function resolveDashboardNextAction(
  input: StudyNextActionInput,
): StudyNextAction {
  return resolveStudyNextAction(input);
}

export function formatDashboardDate(dateKey: string): string {
  return formatStudyNextActionDate(dateKey);
}

export type DashboardWeekSummary = {
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
  percent: number;
  status: "complete" | "on_track" | "adapting" | "not_started";
  nextStudyDate: string | null;
};

function mondayOfWeek(dateKey: string): string {
  const day = parseIsoDate(dateKey).getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(dateKey, -daysSinceMonday);
}

export function summarizeDashboardWeek(
  plan: Pick<StudyPlanResponse, "tasks" | "today">,
): DashboardWeekSummary {
  const startsOn = mondayOfWeek(plan.today);
  const endsOn = addDays(startsOn, 6);
  const tasks = plan.tasks.filter(
    (task) =>
      task.scheduledDate >= startsOn &&
      task.scheduledDate <= endsOn &&
      task.status !== "skipped",
  );
  const completed = tasks.filter((task) => task.status === "completed");
  const totalMinutes = tasks.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0,
  );
  const completedMinutes = completed.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0,
  );
  const hasPastIncompleteTask = tasks.some(
    (task) => task.scheduledDate < plan.today && task.status !== "completed",
  );
  const percent = tasks.length
    ? Math.round((completed.length / tasks.length) * 100)
    : 0;

  return {
    totalTasks: tasks.length,
    completedTasks: completed.length,
    totalMinutes,
    completedMinutes,
    percent,
    status:
      tasks.length === 0
        ? "not_started"
        : completed.length === tasks.length
          ? "complete"
          : hasPastIncompleteTask
            ? "adapting"
            : "on_track",
    nextStudyDate: findNextStudyDate(plan.tasks, plan.today),
  };
}

export function daysUntilPlanningDate(
  today: string,
  planningDate: string,
): number {
  return Math.max(0, daysBetween(today, planningDate));
}

const TASK_QUOTA_AREA: Partial<
  Record<StudyPlanTask["taskType"], UcatQuotaArea>
> = {
  learn: "learn",
  skill_trainer: "skill_trainer",
  practice: "practice",
  section_benchmark: "sets",
  mock: "mocks",
};

export function quotaAreaForTask(
  task: StudyPlanTask | null,
): UcatQuotaArea | null {
  return task ? (TASK_QUOTA_AREA[task.taskType] ?? null) : null;
}

export function selectDashboardQuotaArea(
  areas: UcatQuotaAreaUsage[],
  preferredArea: UcatQuotaArea | null,
): UcatQuotaAreaUsage | null {
  const enabled = areas.filter((area) => !area.disabled && area.limit > 0);
  const preferred = preferredArea
    ? enabled.find((area) => area.area === preferredArea)
    : null;
  if (preferred) return preferred;

  return (
    [...enabled].sort((left, right) => {
      if (left.atLimit !== right.atLimit) return left.atLimit ? -1 : 1;
      const leftRatio = left.limit ? left.used / left.limit : 0;
      const rightRatio = right.limit ? right.used / right.limit : 0;
      if (leftRatio !== rightRatio) return rightRatio - leftRatio;
      if (left.area === "practice") return -1;
      if (right.area === "practice") return 1;
      return left.label.localeCompare(right.label);
    })[0] ?? null
  );
}

export type DashboardDiscountState =
  | "unavailable"
  | "in_progress"
  | "earned_today"
  | "period_complete";

export function dashboardDiscountState(
  discount: PracticeDiscountDashboardStatus,
): DashboardDiscountState {
  if (!discount.eligible || discount.cap <= 0) return "unavailable";
  if (discount.periodCapReached) return "period_complete";
  if (discount.today.earnedCredit) return "earned_today";
  return "in_progress";
}

