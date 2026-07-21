import type { PracticeDiscountDashboardStatus } from "@/lib/ucat/practice-day-discount-dashboard";
import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";
import {
  addDays,
  daysBetween,
  parseIsoDate,
} from "@/features/study-plan/lib/dates";
import {
  findNextStudyDate,
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
} from "@/features/study-plan/lib/companion";
import type {
  StudyGuidanceItem,
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import type {
  UcatQuotaArea,
  UcatQuotaAreaUsage,
} from "@/features/ucat-access/types/quota";

const IMMINENT_SESSION_MS = 90 * 60 * 1000;

export type DashboardNextAction =
  | {
      kind: "session";
      session: StudentUcatSession;
      live: boolean;
    }
  | {
      kind: "task";
      task: StudyPlanTask;
      fromEarlierStudyDay: boolean;
    }
  | {
      kind: "guidance";
      primary: StudyGuidanceItem;
      secondary: StudyGuidanceItem | null;
    }
  | {
      kind: "caught_up";
      nextStudyDate: string | null;
      hadTasksToday: boolean;
    }
  | {
      kind: "plan_setup";
    }
  | {
      kind: "plan_error";
    };

type DashboardActionInput = {
  now: Date;
  sessions: StudentUcatSession[];
  plan: StudyPlanResponse | null | undefined;
  planLoadFailed: boolean;
  samplerDecided: boolean;
  samplerCompleted: boolean;
};

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function findPrioritySession(
  sessions: StudentUcatSession[],
  now: Date,
): { session: StudentUcatSession; live: boolean } | null {
  const nowMs = now.getTime();
  const candidates = sessions
    .map((session) => {
      const start = validTimestamp(session.start_at);
      const end = validTimestamp(session.end_at);
      if (start === null || end === null || nowMs > end) return null;
      const live = nowMs >= start && nowMs <= end;
      const imminent = start > nowMs && start - nowMs <= IMMINENT_SESSION_MS;
      if (!live && !imminent) return null;
      return { session, live, start };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        session: StudentUcatSession;
        live: boolean;
        start: number;
      } => candidate !== null,
    )
    .sort((left, right) => {
      if (left.live !== right.live) return left.live ? -1 : 1;
      return left.start - right.start;
    });

  const first = candidates[0];
  return first ? { session: first.session, live: first.live } : null;
}

export function resolveDashboardNextAction({
  now,
  sessions,
  plan,
  planLoadFailed,
}: DashboardActionInput): DashboardNextAction {
  const prioritySession = findPrioritySession(sessions, now);
  if (prioritySession) {
    return { kind: "session", ...prioritySession };
  }

  if (plan?.profile) {
    if (!plan.profile.studyPlanEnabled && plan.nextSteps[0]) {
      return {
        kind: "guidance",
        primary: plan.nextSteps[0],
        secondary: plan.nextSteps[1] ?? null,
      };
    }
    const currentTasks = selectCurrentStudyPlanTasks(plan.tasks, plan.today);
    const nextTask = selectNextStudyPlanTask(currentTasks);
    if (nextTask)
      return {
        kind: "task",
        task: nextTask,
        fromEarlierStudyDay: nextTask.scheduledDate < plan.today,
      };

    const hadTasksToday = plan.todayTasks.some(
      (task) => task.status !== "skipped",
    );
    return {
      kind: "caught_up",
      nextStudyDate: findNextStudyDate(plan.tasks, plan.today),
      hadTasksToday,
    };
  }

  if (planLoadFailed) return { kind: "plan_error" };

  return { kind: "plan_setup" };
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

export function formatDashboardDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(dateKey));
}
