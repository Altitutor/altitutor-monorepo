import { adelaideTimeToMinutes } from "@/shared/utils/datetime";
import { utcToAdelaideDate } from "@/features/bookings/utils/dateTimeHelpers";

export function adelaideCalendarEndMinutes(start: string, end: string) {
  if (!end) return 0;
  return start && utcToAdelaideDate(end) > utcToAdelaideDate(start)
    ? 24 * 60
    : adelaideTimeToMinutes(end);
}

export function calendarHours(
  intervals: Iterable<{ startMinutes?: number; endMinutes?: number }>,
) {
  let firstHour = 9;
  let lastHour = 21;
  for (const { startMinutes, endMinutes } of intervals) {
    if (startMinutes !== undefined && Number.isFinite(startMinutes)) {
      firstHour = Math.max(0, Math.min(firstHour, Math.floor(startMinutes / 60)));
    }
    if (endMinutes !== undefined && Number.isFinite(endMinutes)) {
      lastHour = Math.min(24, Math.max(lastHour, Math.ceil(endMinutes / 60)));
    }
  }
  return {
    firstHour,
    slots: Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index),
  };
}

export function sessionCalendarHours(sessions: Array<{ start_at: string | null; end_at: string | null }>) {
  return calendarHours(sessions.map(({ start_at, end_at }) => ({
    startMinutes: start_at ? adelaideTimeToMinutes(start_at) : undefined,
    endMinutes: end_at ? adelaideCalendarEndMinutes(start_at ?? "", end_at) : undefined,
  })));
}
