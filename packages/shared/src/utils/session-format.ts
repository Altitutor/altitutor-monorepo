/**
 * Session display formatters shared across admin, student, and tutor apps.
 */

/** Business timezone for scheduling (Adelaide). Session start_at is stored as UTC instants. */
export const BUSINESS_TIMEZONE = 'Australia/Adelaide';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * True when the session start time has passed (UTC instant comparison).
 * Use this instead of calendar-day checks so logging is allowed as soon as the session starts.
 */
export function hasSessionStarted(
  startAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!startAt) return false;
  const start = new Date(startAt);
  if (isNaN(start.getTime())) return false;
  return start.getTime() <= now.getTime();
}

/**
 * Formats a date in the format "Friday 24/10/2025"
 */
export function formatSessionDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const dayName = DAY_NAMES[d.getDay()];
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${dayName} ${day}/${month}/${year}`;
}

/**
 * Session-like shape for time range formatting (start_at/end_at or start_time/end_time or class times).
 */
export interface SessionTimeInput {
  start_at?: string | null;
  end_at?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  class?: { start_time?: string | null; end_time?: string | null } | null;
}

/**
 * Returns a display string for session time range, e.g. "2:00 PM - 4:00 PM".
 * Uses formatTime (from app shared utils) for 12h display.
 */
export function formatSessionTimeRangeForDisplay(
  session: SessionTimeInput,
  formatTime: (timeString: string) => string
): string {
  if (session.start_at && session.end_at) {
    const startDate = new Date(session.start_at);
    const endDate = new Date(session.end_at);
    const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    const endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    return `${formatTime(startHHMM)} - ${formatTime(endHHMM)}`;
  }
  if (session.start_time && session.end_time) {
    return `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`;
  }
  if (session.class?.start_time && session.class?.end_time) {
    return `${formatTime(session.class.start_time)} - ${formatTime(session.class.end_time)}`;
  }
  return '—';
}
