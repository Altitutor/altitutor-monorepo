import { adelaideDateKey } from '@/features/dashboard/timetable';

export type CalendarSpan = 1 | 3 | 7;

const TIME_ZONE = 'Australia/Adelaide';

export function sessionIsCancelled(session: {
  planned_absence?: boolean | null;
  tutor_log_marked_absent?: boolean | null;
}): boolean {
  return session.planned_absence === true || session.tutor_log_marked_absent === true;
}

function dateOnAdelaideDay(key: string): Date {
  return new Date(`${key}T12:00:00+10:30`);
}

export function addAdelaideDays(date: Date, days: number): Date {
  const [year, month, day] = adelaideDateKey(date).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateOnAdelaideDay(shifted.toISOString().slice(0, 10));
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

export function adelaideMinutes(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return ((hour === 24 ? 0 : hour) * 60) + minute;
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
