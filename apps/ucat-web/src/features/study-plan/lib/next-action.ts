import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";
import {
  findNextStudyDate,
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
} from "@/features/study-plan/lib/companion";
import { parseIsoDate } from "@/features/study-plan/lib/dates";
import type {
  StudyGuidanceItem,
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

const IMMINENT_SESSION_MS = 90 * 60 * 1000;

/** Shared “what should the student do next?” model for dashboard + Study orb. */
export type StudyNextAction =
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
      kind: "goal_setup";
    }
  | {
      kind: "plan_error";
    };

export type StudyNextActionInput = {
  now: Date;
  sessions: StudentUcatSession[];
  plan: StudyPlanResponse | null | undefined;
  planLoadFailed: boolean;
  studyPlanDecided: boolean;
  hasGoal: boolean;
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

export function resolveStudyNextAction({
  now,
  sessions,
  plan,
  planLoadFailed,
  studyPlanDecided,
  hasGoal,
}: StudyNextActionInput): StudyNextAction {
  const prioritySession = findPrioritySession(sessions, now);
  if (prioritySession) {
    return { kind: "session", ...prioritySession };
  }

  if (planLoadFailed && !plan?.profile) {
    return { kind: "plan_error" };
  }

  if (plan?.profile?.studyPlanEnabled) {
    const currentTasks = selectCurrentStudyPlanTasks(plan.tasks, plan.today);
    const nextTask = selectNextStudyPlanTask(currentTasks);
    if (nextTask) {
      return {
        kind: "task",
        task: nextTask,
        fromEarlierStudyDay: nextTask.scheduledDate < plan.today,
      };
    }

    const hadTasksToday = plan.todayTasks.some(
      (task) => task.status !== "skipped",
    );
    return {
      kind: "caught_up",
      nextStudyDate: findNextStudyDate(plan.tasks, plan.today),
      hadTasksToday,
    };
  }

  if (!studyPlanDecided) {
    return { kind: "plan_setup" };
  }

  if (!hasGoal) {
    return { kind: "goal_setup" };
  }

  if (plan?.profile && !plan.profile.studyPlanEnabled && plan.nextSteps[0]) {
    return {
      kind: "guidance",
      primary: plan.nextSteps[0],
      secondary: plan.nextSteps[1] ?? null,
    };
  }

  if (plan?.profile) {
    return {
      kind: "caught_up",
      nextStudyDate: null,
      hadTasksToday: false,
    };
  }

  return { kind: "goal_setup" };
}

export function formatStudyNextActionDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(dateKey));
}

export type StudyNextActionContent = {
  eyebrow: string;
  title: string;
  description: string;
  rationale: string | null;
  meta: string | null;
  primaryLabel: string;
  primaryHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
};

export function describeStudyNextAction(
  action: StudyNextAction,
  options?: { sessionTimeLabel?: string | null },
): StudyNextActionContent {
  switch (action.kind) {
    case "session":
      return {
        eyebrow: action.live ? "Live now" : "Starting soon",
        title: action.live
          ? "Join your UCAT session"
          : "Your UCAT session is next",
        description: action.session.class_level
          ? `${action.session.class_level} session with your class.`
          : "Your tutor-led UCAT session is ready when you are.",
        rationale: action.live
          ? "Your session takes priority over independent Study plan work."
          : "We’ll keep your independent task waiting until after the session.",
        meta: options?.sessionTimeLabel ?? null,
        primaryLabel: action.live ? "Join session" : "View session",
        primaryHref: `/sessions/${encodeURIComponent(action.session.session_id)}`,
        secondaryLabel: null,
        secondaryHref: null,
      };
    case "task":
      return {
        eyebrow: action.fromEarlierStudyDay
          ? "Still to do"
          : action.task.taskType === "review"
            ? "Most useful now"
            : "Next up",
        title: action.task.title,
        description: action.task.description,
        rationale: action.fromEarlierStudyDay
          ? "This was planned for an earlier study day. Finish it now, or open your Study plan to skip it without losing the rest of today’s direction."
          : action.task.rationale || null,
        meta: `About ${action.task.estimatedMinutes} min`,
        primaryLabel:
          action.task.status === "in_progress" ||
          action.task.status === "partial"
            ? "Continue task"
            : action.task.taskType === "review"
              ? "Review result"
              : "Start today’s task",
        primaryHref: null,
        secondaryLabel: "Open Study plan",
        secondaryHref: "/study-plan",
      };
    case "guidance":
      return {
        eyebrow:
          action.primary.taskType === "review"
            ? "Most useful now"
            : "Best next step",
        title: action.primary.title,
        description: action.primary.description,
        rationale: action.primary.rationale || null,
        meta: `About ${action.primary.estimatedMinutes} min`,
        primaryLabel:
          action.primary.taskType === "review" ? "Review result" : "Start",
        primaryHref: action.primary.launchPath,
        secondaryLabel: null,
        secondaryHref: null,
      };
    case "caught_up":
      return {
        eyebrow: action.hadTasksToday ? "Today’s work" : "Today",
        title: action.hadTasksToday
          ? "Today’s Study plan is complete"
          : "Today is a rest day",
        description: action.hadTasksToday
          ? "You’ve completed everything the plan asked of you today."
          : "There’s no planned work today. Rest is already part of your preparation.",
        rationale: action.nextStudyDate
          ? `Your next planned study block is ${formatStudyNextActionDate(action.nextStudyDate)}.`
          : "Your plan has no further scheduled work right now.",
        meta: null,
        primaryLabel: action.hadTasksToday
          ? "I have time for more"
          : "I’d like to study today",
        primaryHref: null,
        secondaryLabel: "View Study plan",
        secondaryHref: "/study-plan",
      };
    case "plan_setup":
      return {
        eyebrow: "Your next step",
        title: "Organise your study with a Study plan",
        description:
          "Altitutor can schedule adaptive work around your availability and adjust it as your performance changes.",
        rationale:
          "A Study plan gives you a clearer weekly path based on your goal and availability.",
        meta: "About 3 min to set up",
        primaryLabel: "Set up Study plan",
        primaryHref: "/study-plan/setup?section=plan",
        secondaryLabel: null,
        secondaryHref: null,
      };
    case "goal_setup":
      return {
        eyebrow: "Your next step",
        title: "Set your UCAT year and target score",
        description:
          "Give your dashboard a clear destination before you continue with suggested study activities.",
        rationale:
          "Your target is a working direction, not a prediction. You can change it at any time.",
        meta: "UCAT year · working target",
        primaryLabel: "Set my goal",
        primaryHref: "/ucat-goal/setup",
        secondaryLabel: "Skip for now",
        secondaryHref: null,
      };
    case "plan_error":
      return {
        eyebrow: "Study plan unavailable",
        title: "We couldn’t load your next step",
        description: "Your existing Study plan has not been changed.",
        rationale: "Try loading it again before starting unrelated work.",
        meta: null,
        primaryLabel: "Try again",
        primaryHref: null,
        secondaryLabel: null,
        secondaryHref: null,
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
