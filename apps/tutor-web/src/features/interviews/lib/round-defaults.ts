import type { InterviewRoundSetup } from "@altitutor/shared";

/** Keep the local date and time together when the next hour crosses midnight. */
export function nextInterviewRoundSchedule(now = new Date()): Date {
  const value = new Date(now);
  value.setHours(value.getHours() + 1, 0, 0, 0);
  return value;
}

type RoundDefaults = Pick<InterviewRoundSetup, "interviewId" | "delivery" | "mode" | "recordingEnabled" | "rotationAllowanceSeconds" | "scheduledAt"> & { schedule: "now" | "later" };
const key = (actorId: string) => `interview-round-defaults:${actorId}`;

export function readRoundDefaults(actorId: string): RoundDefaults | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(actorId)) ?? "null");
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, unknown>;
    if (typeof data.interviewId !== "string" || !["online", "in_person"].includes(String(data.delivery)) ||
      !["exam", "feedback"].includes(String(data.mode)) || typeof data.recordingEnabled !== "boolean" ||
      typeof data.rotationAllowanceSeconds !== "number" || !Number.isInteger(data.rotationAllowanceSeconds) ||
      data.rotationAllowanceSeconds < 0 || data.rotationAllowanceSeconds > 7200 ||
      !["now", "later"].includes(String(data.schedule)) ||
      (data.scheduledAt !== null && (typeof data.scheduledAt !== "string" || !Number.isFinite(Date.parse(data.scheduledAt))))) return null;
    return data as RoundDefaults;
  } catch { return null; }
}

export function rememberRoundDefaults(actorId: string, setup: InterviewRoundSetup, schedule: "now" | "later") {
  try {
    const { interviewId, delivery, mode, recordingEnabled, rotationAllowanceSeconds, scheduledAt } = setup;
    localStorage.setItem(key(actorId), JSON.stringify({ interviewId, delivery, mode, recordingEnabled,
      rotationAllowanceSeconds: rotationAllowanceSeconds ?? 0, scheduledAt, schedule }));
  } catch { /* Round creation still succeeds when browser storage is unavailable. */ }
}
