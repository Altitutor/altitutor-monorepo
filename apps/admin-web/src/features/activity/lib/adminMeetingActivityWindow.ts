/** How long after scheduled end_at we still treat the meeting as "live" (overrun). */
export const ADMIN_MEETING_OVERRUN_GRACE_MS = 6 * 60 * 60 * 1000;

export interface AdminMeetingActivityWindow {
  start: string;
  end: string;
  /** True when the upper bound is wall-clock now (meeting in progress / overrun). */
  isLive: boolean;
}

/**
 * Time window for admin-meeting work-item activity.
 * - Before start: empty-ish window (start → scheduled end or start)
 * - During / overrun grace: start → now (captures live assigns/creates/status moves)
 * - After grace: start → end_at (retrospective transcript)
 */
export function getAdminMeetingActivityWindow(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  now: Date = new Date()
): AdminMeetingActivityWindow {
  const start = startAt ? new Date(startAt) : now;
  const scheduledEnd = endAt ? new Date(endAt) : null;

  if (Number.isNaN(start.getTime())) {
    const iso = now.toISOString();
    return { start: iso, end: iso, isLive: true };
  }

  // Meeting has not started yet
  if (start.getTime() > now.getTime()) {
    const end = scheduledEnd && !Number.isNaN(scheduledEnd.getTime()) ? scheduledEnd : start;
    return { start: start.toISOString(), end: end.toISOString(), isLive: false };
  }

  const withinOverrunGrace =
    !scheduledEnd ||
    Number.isNaN(scheduledEnd.getTime()) ||
    scheduledEnd.getTime() + ADMIN_MEETING_OVERRUN_GRACE_MS >= now.getTime();

  if (withinOverrunGrace) {
    return { start: start.toISOString(), end: now.toISOString(), isLive: true };
  }

  return {
    start: start.toISOString(),
    end: scheduledEnd!.toISOString(),
    isLive: false,
  };
}
