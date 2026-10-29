/** Scheduling wall-clock values, deliberately independent of a timezone or date. */

const WORK_START_MINUTES = 8 * 60;
const WORK_END_MINUTES = 20 * 60;

const presets = Array.from({ length: 96 }, (_, index) =>
  formatTime(Math.floor(index / 4), (index % 4) * 15),
);

type ClockReading = {
  hours: number;
  minutes: number;
  /** am/pm or an unambiguous 24-hour value, so the other half of the day is not offered. */
  explicit: boolean;
  hourOnly: boolean;
};

function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isWorkingTime(hours: number, minutes: number): boolean {
  const total = hours * 60 + minutes;
  return total >= WORK_START_MINUTES && total <= WORK_END_MINUTES;
}

function parseClock(input: string): ClockReading | null {
  const match = input
    .trim()
    .toLowerCase()
    .match(/^(?:(\d{1,2}):(\d{2})(?::(\d{2}))?|(\d{1,4}))\s*(am|pm)?$/);
  if (!match) return null;

  const meridian = match[5] as 'am' | 'pm' | undefined;
  const colonHour = match[1];
  const compact = match[4];
  const seconds = match[3];
  if (seconds !== undefined && Number(seconds) > 59) return null;
  let hours: number;
  let minutes: number;
  let hourOnly: boolean;

  if (match[1] !== undefined) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
    hourOnly = false;
  } else if (compact!.length <= 2) {
    hours = Number(compact);
    minutes = 0;
    hourOnly = true;
  } else if (compact!.length === 3) {
    hours = Number(compact!.slice(0, 1));
    minutes = Number(compact!.slice(1));
    hourOnly = false;
  } else {
    hours = Number(compact!.slice(0, 2));
    minutes = Number(compact!.slice(2));
    hourOnly = false;
  }

  if (minutes > 59 || hours > 23) return null;

  if (meridian) {
    if (hours < 1 || hours > 12) return null;
    return {
      hours: (hours % 12) + (meridian === 'pm' ? 12 : 0),
      minutes,
      explicit: true,
      hourOnly,
    };
  }

  const explicit24 =
    (compact !== undefined && (compact.length === 4 || (compact.length === 2 && compact.startsWith('0')))) ||
    (colonHour !== undefined && colonHour.length === 2) ||
    hours === 0 ||
    hours > 12;
  if (explicit24) {
    return { hours, minutes, explicit: true, hourOnly };
  }

  if (hours < 1 || hours > 12) return null;
  const amHours = hours % 12;
  const pmHours = amHours + 12;
  const preferPm = isWorkingTime(pmHours, minutes) && !isWorkingTime(amHours, minutes);
  return {
    hours: preferPm ? pmHours : amHours,
    minutes,
    explicit: false,
    hourOnly,
  };
}

function alternateTime(clock: ClockReading): string | null {
  if (clock.explicit) return null;
  const otherHours = clock.hours >= 12 ? clock.hours % 12 : (clock.hours % 12) + 12;
  return formatTime(otherHours, clock.minutes);
}

export function parseTime(input: string): string | null {
  const clock = parseClock(input);
  return clock ? formatTime(clock.hours, clock.minutes) : null;
}

export function timeLabel(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const [hour, minute] = parsed.split(':');
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'pm' : 'am'}`;
}

export function timeOptions(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return presets;

  const clock = parseClock(trimmed);
  if (!clock) return [];

  const preferred = formatTime(clock.hours, clock.minutes);
  const alternate = alternateTime(clock);
  if (!clock.hourOnly) {
    return alternate ? [preferred, alternate] : [preferred];
  }

  const hoursIn = (value: string) => Number(value.slice(0, 2));
  const preferredHour = presets.filter((value) => hoursIn(value) === clock.hours);
  const alternateHour = alternate
    ? presets.filter((value) => hoursIn(value) === Number(alternate.slice(0, 2)))
    : [];
  const ordered = preferredHour.includes(preferred) ? [...preferredHour] : [preferred, ...preferredHour];
  for (const value of alternateHour) {
    if (!ordered.includes(value)) ordered.push(value);
  }
  return ordered;
}
