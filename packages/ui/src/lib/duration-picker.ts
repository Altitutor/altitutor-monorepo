import { parseTime } from './time-picker';

/** The duration choices already offered when booking a check-in. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

const MINUTE = 1;
const MAX_SAME_DAY_MINUTES = 24 * 60 - 1;

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function clockMinutes(value: string): number | null {
  const parsed = parseTime(value);
  if (!parsed) return null;
  const [hours, minutes] = parsed.split(':').map(Number);
  return hours * 60 + minutes;
}

export function durationLabel(minutes: number): string {
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** Reads a typed minute count such as `301` or `301 minutes`. */
export function parseDurationMinutes(input: string): number | null {
  const match = input.trim().toLowerCase().match(/^(\d+)\s*(?:minutes?|mins?|m)?$/);
  if (!match?.[1]) return null;
  const minutes = Number(match[1]);
  if (!Number.isInteger(minutes) || minutes < MINUTE || minutes > MAX_SAME_DAY_MINUTES) return null;
  return minutes;
}

export function durationOptions(query: string, current?: number | null): number[] {
  const trimmed = query.trim();
  const presets: readonly number[] = DURATION_PRESETS;
  if (!trimmed) {
    if (current != null && !presets.includes(current)) {
      return [current, ...presets];
    }
    return [...presets];
  }

  const exact = parseDurationMinutes(trimmed);
  const digits = trimmed.match(/^(\d+)/)?.[1];
  const matches = DURATION_PRESETS.filter((minutes) => digits != null && String(minutes).startsWith(digits));
  if (exact == null) return [...matches];
  return [exact, ...matches.filter((minutes) => minutes !== exact)];
}

export function durationMinutesBetween(start: string, end: string): number | null {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes == null || endMinutes == null) return null;
  const duration = endMinutes - startMinutes;
  return duration > 0 ? duration : null;
}

/** Adds minutes to a wall-clock start, staying on the same day. */
export function addMinutesToTime(start: string, minutes: number): string | null {
  const startMinutes = clockMinutes(start);
  if (startMinutes == null || !Number.isInteger(minutes) || minutes < MINUTE) return null;
  const total = startMinutes + minutes;
  if (total >= 24 * 60) return null;
  return formatTime(total);
}

/**
 * Moves the start while keeping the current length.
 * Returns null when that length would run past the end of the day.
 */
export function shiftStartKeepingDuration(
  startTime: string,
  endTime: string,
  nextStart: string,
): { startTime: string; endTime: string } | null {
  const minutes = durationMinutesBetween(startTime, endTime);
  if (minutes == null) return { startTime: nextStart, endTime };
  const nextEnd = addMinutesToTime(nextStart, minutes);
  if (!nextEnd) return null;
  return { startTime: nextStart, endTime: nextEnd };
}
