/** Temporary diagnostic payload: client observations, never authorization facts. */
export const STUDY_PLAN_LAUNCH_TTL_MS = 5 * 60 * 1000;
const MAX_PLAN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STATUSES = [
  "planned",
  "partial",
  "in_progress",
  "completed",
  "skipped",
] as const;
export const STUDY_PLAN_LAUNCH_SURFACES = [
  "study-plan",
  "dashboard",
  "setup",
  "practice",
  "learn",
  "exam",
  "progress",
  "review",
  "results",
  "skill-trainer",
  "sets",
  "mocks",
  "sessions",
  "settings",
  "getting-started",
  "other",
] as const;
const CONTROLS = [
  "task-list",
  "dashboard-next-task",
  "companion-primary",
  "companion-secondary",
] as const;
const ACTIONS = [
  "start",
  "continue-out-of-order",
  "start-recommended",
] as const;

export type StudyPlanLaunchDiagnostics = {
  version: 1;
  captured_at_ms: number;
  surface: (typeof STUDY_PLAN_LAUNCH_SURFACES)[number];
  control: (typeof CONTROLS)[number];
  launch_action: (typeof ACTIONS)[number];
  task_status: (typeof STATUSES)[number];
  task_type: "practice" | "learn";
  plan_age_ms: number | null;
  visibility: "visible" | "hidden" | "unknown";
  focused: boolean | null;
  recent_action?: "skip" | "unskip";
  recent_action_age_ms?: number;
};

function member<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
function bounded(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

/** Revalidate at the HTTP boundary; copy only allowlisted primitive fields. */
export function parseStudyPlanLaunchDiagnostics(
  input: unknown,
  expectedType: "practice" | "learn",
  now = Date.now(),
): StudyPlanLaunchDiagnostics | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const value = input as Record<string, unknown>;
  if (
    value.version !== 1 ||
    !bounded(value.captured_at_ms, Number.MAX_SAFE_INTEGER) ||
    value.captured_at_ms > now + 5000 ||
    now - value.captured_at_ms > STUDY_PLAN_LAUNCH_TTL_MS ||
    !member(value.surface, STUDY_PLAN_LAUNCH_SURFACES) ||
    !member(value.control, CONTROLS) ||
    !member(value.launch_action, ACTIONS) ||
    !member(value.task_status, STATUSES) ||
    value.task_type !== expectedType ||
    !(
      value.plan_age_ms === null || bounded(value.plan_age_ms, MAX_PLAN_AGE_MS)
    ) ||
    !member(value.visibility, ["visible", "hidden", "unknown"]) ||
    !(value.focused === null || typeof value.focused === "boolean")
  )
    return;
  const result: StudyPlanLaunchDiagnostics = {
    version: 1,
    captured_at_ms: value.captured_at_ms,
    surface: value.surface,
    control: value.control,
    launch_action: value.launch_action,
    task_status: value.task_status,
    task_type: expectedType,
    plan_age_ms: value.plan_age_ms,
    visibility: value.visibility,
    focused: value.focused,
  };
  if (
    member(value.recent_action, ["skip", "unskip"]) &&
    bounded(value.recent_action_age_ms, STUDY_PLAN_LAUNCH_TTL_MS)
  ) {
    result.recent_action = value.recent_action;
    result.recent_action_age_ms = value.recent_action_age_ms;
  }
  return result;
}

export function planObservationAge(
  updatedAt: number,
  now: number,
): number | null {
  return Number.isFinite(updatedAt) && updatedAt > 0 && updatedAt <= now
    ? Math.min(MAX_PLAN_AGE_MS, Math.round(now - updatedAt))
    : null;
}
