import { BUSINESS_TIMEZONE, hasSessionStarted } from '@altitutor/shared';
import { staffMaySubmitTutorLog } from '@altitutor/shared/pay-tiers';

const INTERVIEW_TYPES = new Set(['STAFF_INTERVIEW', 'SUBSIDY_INTERVIEW']);

const calendarDay = new Intl.DateTimeFormat('en-AU', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const wallClock = new Intl.DateTimeFormat('en-AU', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});
const dateLabel = new Intl.DateTimeFormat('en-AU', {
  timeZone: BUSINESS_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const timeLabel = new Intl.DateTimeFormat('en-AU', {
  timeZone: BUSINESS_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
});

function dayParts(date: Date) {
  const parts = calendarDay.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

export function adelaideDateKey(date: Date) {
  const { year, month, day } = dayParts(date);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function addAdelaideDays(date: Date, days: number) {
  const { year, month, day } = dayParts(date);
  return new Date(Date.UTC(year, month - 1, day + days, 2));
}

function startOfAdelaideDay(date: Date) {
  const { year, month, day } = dayParts(date);
  const midnight = Date.UTC(year, month - 1, day);
  const probe = midnight - 12 * 60 * 60 * 1000;
  const parts = wallClock.formatToParts(new Date(probe));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  return new Date(midnight - (wall - probe));
}

export function adelaideDayRange(date: Date, days = 1) {
  return {
    from: startOfAdelaideDay(date).toISOString(),
    to: startOfAdelaideDay(addAdelaideDays(date, days)).toISOString(),
  };
}

export function sessionDate(value: string | Date) {
  return dateLabel.format(new Date(value));
}

export function sessionTime(start: string | null, end?: string | null) {
  if (!start) return 'Time to be confirmed';
  return [timeLabel.format(new Date(start)), end ? timeLabel.format(new Date(end)) : null].filter(Boolean).join(' – ');
}

export function sessionTypeLabel(type: string | null | undefined) {
  if (type === 'CHECK_IN') return 'Check-in';
  return type ? type.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Session';
}

export function sessionTitle(row: {
  short_name: string | null;
  long_name: string | null;
  subject_name: string | null;
  session_type: string | null;
}) {
  return row.short_name || row.long_name || row.subject_name || sessionTypeLabel(row.session_type);
}

export function mayShowSession(type: string | null) {
  return !type || !INTERVIEW_TYPES.has(type);
}

type LoggableSession = {
  start_at: string | null;
  session_type: string | null;
  session_status: string | null;
  calendar_tombstone_until: string | null;
};

export function sessionIsCancelled(session: Pick<LoggableSession, 'session_status' | 'calendar_tombstone_until'>) {
  return session.session_status !== 'ACTIVE' || session.calendar_tombstone_until !== null;
}

export function mayLogSession(
  session: LoggableSession,
  assignmentType: string | null | undefined,
  retainedLog: object | null,
  now = new Date(),
) {
  return !retainedLog &&
    mayShowSession(session.session_type) &&
    !sessionIsCancelled(session) &&
    hasSessionStarted(session.start_at, now) &&
    staffMaySubmitTutorLog(session.session_type, assignmentType);
}

export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry));
}

export type SessionPerson = {
  id: string;
  name: string;
  type?: string;
  plannedAbsence: boolean;
  swapped: boolean;
  swappedIn: boolean;
  swappedName?: string;
  extra: boolean;
};

function nameFromRecord(entry: Record<string, unknown>) {
  return [entry.first_name, entry.last_name].filter((value) => typeof value === 'string' && value.trim()).join(' ');
}

export function readPeople(value: unknown): SessionPerson[] {
  return records(value).flatMap((entry) => {
    if (typeof entry.id !== 'string' || !entry.id) return [];
    const swappedStaff = records([entry.swapped_staff])[0];
    return [{
      id: entry.id,
      name: nameFromRecord(entry) || 'Name unavailable',
      type: typeof entry.type === 'string' ? entry.type : undefined,
      plannedAbsence: entry.planned_absence === true,
      swapped: entry.is_swapped === true,
      swappedIn: entry.is_swapped_in === true,
      swappedName: swappedStaff ? nameFromRecord(swappedStaff) : undefined,
      extra: entry.is_extra === true,
    }];
  });
}

export function plainNote(content: unknown): string {
  if (typeof content === 'string') return content;
  if (typeof content !== 'object' || content === null) return '';
  const entry = records([content])[0];
  if (!entry) return '';
  if (typeof entry.text === 'string') return entry.text;
  if (!Array.isArray(entry.content)) return '';
  return entry.content.map(plainNote).filter(Boolean).join(entry.type === 'paragraph' ? '' : '\n');
}

export type CalendarSpan = 1 | 3 | 7;

export function adelaideMinutes(date: Date) {
  const parts = wallClock.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return part('hour') * 60 + part('minute');
}

export function adelaideWeekday(date: Date): number {
  const [year, month, day] = adelaideDateKey(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfAdelaideWeek(date: Date): Date {
  const weekday = adelaideWeekday(date);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addAdelaideDays(date, mondayOffset);
}

export function adelaideWeek(date: Date): Date[] {
  const monday = startOfAdelaideWeek(date);
  return Array.from({ length: 7 }, (_, index) => addAdelaideDays(monday, index));
}

export function visibleCalendarDays(anchor: Date, span: CalendarSpan): Date[] {
  if (span === 7) return adelaideWeek(anchor);
  return Array.from({ length: span }, (_, index) => addAdelaideDays(anchor, index));
}

export type DayLayoutEvent = { id: string; startMin: number; endMin: number };

export function layoutDayEvents(events: DayLayoutEvent[]): { id: string; column: number; columns: number }[] {
  const sorted = [...events].sort((left, right) => left.startMin - right.startMin || left.endMin - right.endMin);
  const placed: { id: string; column: number; endMin: number; cluster: number }[] = [];
  let cluster = 0;
  let clusterEnd = -1;
  for (const event of sorted) {
    if (event.startMin >= clusterEnd) {
      cluster += 1;
      clusterEnd = event.endMin;
    } else {
      clusterEnd = Math.max(clusterEnd, event.endMin);
    }
    const used = placed.filter((item) => item.cluster === cluster && item.endMin > event.startMin).map((item) => item.column);
    let column = 0;
    while (used.includes(column)) column += 1;
    placed.push({ id: event.id, column, endMin: event.endMin, cluster });
  }
  return placed.map((item) => ({
    id: item.id,
    column: item.column,
    columns: Math.max(...placed.filter((peer) => peer.cluster === item.cluster).map((peer) => peer.column)) + 1,
  }));
}
