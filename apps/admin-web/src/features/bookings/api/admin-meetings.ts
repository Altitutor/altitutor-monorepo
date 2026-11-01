import { z } from "zod";

export const MANUAL_MEETING_TYPES = [
  "DRAFTING",
  "TRIAL_SESSION",
  "SUBSIDY_INTERVIEW",
  "STAFF_INTERVIEW",
  "CHECK_IN",
  "ADMIN_MEETING",
] as const;
export type ManualMeetingType = (typeof MANUAL_MEETING_TYPES)[number];
const ids = z.array(z.string().guid('Invalid uuid')).default([]);
export const manualMeetingSchema = z
  .object({
    type: z.enum(MANUAL_MEETING_TYPES),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    studentIds: ids,
    parentIds: ids,
    staffIds: ids,
    receiverStaffIds: ids,
    subjectId: z.string().guid('Invalid uuid').nullable().optional(),
    originalSessionId: z.string().guid('Invalid uuid').nullable().optional(),
  })
  .refine((value) => new Date(value.endAt) > new Date(value.startAt), {
    message: "Choose a positive duration",
    path: ["endAt"],
  })
  .refine((value) => value.type !== "DRAFTING" || Boolean(value.subjectId), {
    message: "Choose a subject for drafting",
    path: ["subjectId"],
  });
export type ManualMeetingInput = z.infer<typeof manualMeetingSchema>;

export async function createManualMeeting(
  input: ManualMeetingInput,
): Promise<string> {
  const response = await fetch("/api/sessions/manual-meeting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as {
    sessionId?: string;
    error?: string;
  };
  if (!response.ok || !result.sessionId)
    throw new Error(result.error ?? "Could not book meeting");
  return result.sessionId;
}

export type MeetingWarning = { staff_id: string; reason: string };
export async function getManualMeetingWarnings(
  input: ManualMeetingInput,
): Promise<MeetingWarning[]> {
  const params = new URLSearchParams({ input: JSON.stringify(input) });
  const response = await fetch(`/api/sessions/manual-meeting?${params}`);
  if (!response.ok) throw new Error("Availability could not be checked");
  return response.json() as Promise<MeetingWarning[]>;
}
