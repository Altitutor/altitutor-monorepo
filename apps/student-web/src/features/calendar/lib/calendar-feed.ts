import { Buffer } from "node:buffer";
import type { Database } from "@altitutor/shared";

type SessionType = Database["public"]["Enums"]["session_type"];
export type CalendarSessionStatus = "ACTIVE" | "INACTIVE";

export interface CalendarSession {
  id: string;
  type: SessionType;
  classId: string | null;
  startAt: string;
  endAt: string;
  updatedAt: string | null;
  status: CalendarSessionStatus;
  subjectLongName: string | null;
  subjectName: string | null;
}

/** Keep cancelled sessions in the feed long enough for slow clients to process them. */
export const CANCELLED_TOMBSTONE_RETENTION_MS = 1000 * 60 * 60 * 24 * 90;

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  CLASS: "class",
  DRAFTING: "drafting",
  EXAM_COURSE: "exam course",
  SUBSIDY_INTERVIEW: "subsidy interview",
  TRIAL_SESSION: "trial session",
  STAFF_INTERVIEW: "staff interview",
  ADMIN_SHIFT: "admin shift",
  CHECK_IN: "check-in",
  ADMIN_MEETING: "meeting",
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtc(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * Clients (especially Google Calendar) require SEQUENCE to increase when
 * scheduling properties change. Derive a monotonic integer from the session's
 * revision time so reschedules replace the prior VEVENT for the same UID.
 */
export function getCalendarEventSequence(modifiedAt: string): number {
  const ms = new Date(modifiedAt).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 1000);
}

function foldLine(line: string): string[] {
  if (Buffer.byteLength(line, "utf8") <= 75) return [line];

  const lines: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    const limit = lines.length === 0 ? 75 : 74;
    if (currentBytes + characterBytes > limit) {
      lines.push(lines.length === 0 ? current : ` ${current}`);
      current = character;
      currentBytes = characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }

  if (current) lines.push(lines.length === 0 ? current : ` ${current}`);
  return lines;
}

export function getCalendarEventTitle(session: CalendarSession): string {
  if (session.classId) {
    const subject = session.subjectLongName || session.subjectName || "class";
    return `Altitutor class: ${subject}`;
  }

  return `Altitutor ${SESSION_TYPE_LABELS[session.type]}`;
}

export function shouldIncludeInCalendarFeed(
  session: Pick<CalendarSession, "status" | "updatedAt" | "startAt">,
  nowMs: number = Date.now(),
): boolean {
  if (session.status === "ACTIVE") return true;
  if (session.status !== "INACTIVE") return false;

  const revisedAt = session.updatedAt || session.startAt;
  const revisedMs = new Date(revisedAt).getTime();
  if (Number.isNaN(revisedMs)) return false;
  return nowMs - revisedMs <= CANCELLED_TOMBSTONE_RETENTION_MS;
}

export function buildStudentCalendarFeed(
  sessions: CalendarSession[],
  studentBaseUrl: string,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Altitutor//Student Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Altitutor Timetable",
    "X-WR-TIMEZONE:Australia/Adelaide",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const session of sessions) {
    if (!shouldIncludeInCalendarFeed(session)) continue;

    const detailsUrl = new URL("/classes", studentBaseUrl);
    detailsUrl.searchParams.set("session", session.id);
    const modifiedAt = session.updatedAt || session.startAt;
    const cancelled = session.status === "INACTIVE";

    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${session.id}@altitutor.com`,
      `DTSTAMP:${formatUtc(modifiedAt)}`,
      `LAST-MODIFIED:${formatUtc(modifiedAt)}`,
      `SEQUENCE:${getCalendarEventSequence(modifiedAt)}`,
      `DTSTART:${formatUtc(session.startAt)}`,
      `DTEND:${formatUtc(session.endAt)}`,
      `SUMMARY:${escapeText(getCalendarEventTitle(session))}`,
      `DESCRIPTION:${escapeText(`View session details: ${detailsUrl.toString()}`)}`,
      `URL:${escapeText(detailsUrl.toString())}`,
      `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
      cancelled ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
}
