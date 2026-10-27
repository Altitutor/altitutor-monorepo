import type { QueryClient } from "@tanstack/react-query";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import {
  parseStudyPlanLaunchDiagnostics,
  planObservationAge,
  STUDY_PLAN_LAUNCH_TTL_MS,
  STUDY_PLAN_LAUNCH_SURFACES,
  type StudyPlanLaunchDiagnostics,
} from "@/features/study-plan/model/launch-diagnostics";
import { isMobileAuthBrowserContext } from "@/lib/privacy/mobile-auth-telemetry";

const STORAGE_KEY = "ucat-study-plan-launch-diagnostics";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 6;
type Action = { taskId: string; at: number; action: "skip" | "unskip" };
type Launch = { taskId: string; context: StudyPlanLaunchDiagnostics };
type History = { actions: Action[]; launches: Launch[] };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function allowed(): boolean {
  return typeof window !== "undefined" && !isMobileAuthBrowserContext();
}
function read(): History {
  const empty: History = { actions: [], launches: [] };
  if (!allowed()) return empty;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 4096) return empty;
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return empty;
    const { actions, launches } = value;
    const now = Date.now();
    if (Array.isArray(actions))
      for (const item of actions.slice(-MAX_ENTRIES) as unknown[]) {
        if (
          record(item) &&
          typeof item.taskId === "string" &&
          UUID.test(item.taskId) &&
          typeof item.at === "number" &&
          Number.isInteger(item.at) &&
          item.at <= now &&
          now - item.at <= STUDY_PLAN_LAUNCH_TTL_MS &&
          (item.action === "skip" || item.action === "unskip")
        )
          empty.actions.push({
            taskId: item.taskId,
            at: item.at,
            action: item.action,
          });
      }
    if (Array.isArray(launches))
      for (const item of launches.slice(-MAX_ENTRIES) as unknown[]) {
        if (
          !record(item) ||
          typeof item.taskId !== "string" ||
          !UUID.test(item.taskId)
        )
          continue;
        const context = parseStudyPlanLaunchDiagnostics(
          item.context,
          "learn",
          now,
        );
        if (context) empty.launches.push({ taskId: item.taskId, context });
      }
  } catch {
    /* Optional browser storage cannot affect an action. */
  }
  return empty;
}
function write(history: History) {
  if (!allowed()) return;
  try {
    const raw = JSON.stringify({
      actions: history.actions.slice(-MAX_ENTRIES),
      launches: history.launches.slice(-MAX_ENTRIES),
    });
    if (raw.length <= 4096) sessionStorage.setItem(STORAGE_KEY, raw);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage may be disabled or full. */
  }
}

export function recordStudyPlanTaskAction(
  taskId: string,
  action: string,
): void {
  if (
    !allowed() ||
    !UUID.test(taskId) ||
    (action !== "skip" && action !== "unskip")
  )
    return;
  const history = read();
  history.actions.push({ taskId, action, at: Date.now() });
  write(history);
}

function launchSurface(path: string): StudyPlanLaunchDiagnostics["surface"] {
  if (path === "/study-plan/setup") return "setup";
  if (
    path.startsWith("/progress/") &&
    (path.includes("-attempts/") || path.includes("/practice-sessions/"))
  )
    return "review";
  if (path.startsWith("/skill-trainer/") && path.includes("/results/"))
    return "results";
  const section = path.split("/")[1];
  return (
    STUDY_PLAN_LAUNCH_SURFACES.find((surface) => surface === section) ?? "other"
  );
}

export function observeStudyPlanLaunch(
  task: StudyPlanTask,
  queryClient: QueryClient,
  launchAction: StudyPlanLaunchDiagnostics["launch_action"],
  control: StudyPlanLaunchDiagnostics["control"],
): StudyPlanLaunchDiagnostics | undefined {
  if (!allowed() || (task.taskType !== "practice" && task.taskType !== "learn"))
    return;
  try {
    const now = Date.now();
    // Match the actual rendered object, not a fresher same-ID task in another query.
    const matchingQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["ucat-study-plan"] })
      .filter(({ state }) => {
        const data = state.data as StudyPlanResponse | undefined;
        return data?.tasks?.includes(task) || data?.todayTasks?.includes(task);
      });
    const updatedAtValues = new Set(
      matchingQueries.map((query) => query.state.dataUpdatedAt),
    );
    const updatedAt =
      updatedAtValues.size === 1 ? matchingQueries[0]!.state.dataUpdatedAt : 0;
    const recent = read()
      .actions.filter((item) => item.taskId === task.id)
      .at(-1);
    const path = window.location.pathname;
    return parseStudyPlanLaunchDiagnostics(
      {
        version: 1,
        captured_at_ms: now,
        surface: launchSurface(path),
        control,
        launch_action: launchAction,
        task_status: task.status,
        task_type: task.taskType,
        plan_age_ms: planObservationAge(updatedAt, now),
        visibility:
          document.visibilityState === "visible" ||
          document.visibilityState === "hidden"
            ? document.visibilityState
            : "unknown",
        focused:
          typeof document.hasFocus === "function" ? document.hasFocus() : null,
        ...(recent
          ? {
              recent_action: recent.action,
              recent_action_age_ms: now - recent.at,
            }
          : {}),
      },
      task.taskType,
      now,
    );
  } catch {
    return; /* Observability must never change the launch. */
  }
}

/** The next lesson request consumes this tab-local, task-bound observation once. */
export function rememberStudyPlanLessonLaunch(
  taskId: string,
  context: StudyPlanLaunchDiagnostics | undefined,
): void {
  if (!allowed() || !UUID.test(taskId) || !context) return;
  const history = read();
  history.launches = history.launches.filter((item) => item.taskId !== taskId);
  history.launches.push({ taskId, context });
  write(history);
}
export function consumeStudyPlanLessonLaunch(
  taskId: string | null,
): StudyPlanLaunchDiagnostics | undefined {
  if (!allowed() || !taskId || !UUID.test(taskId)) return;
  const history = read();
  const launch = history.launches.find((item) => item.taskId === taskId);
  history.launches = history.launches.filter((item) => item.taskId !== taskId);
  write(history);
  return launch?.context;
}
