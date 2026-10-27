import { formatDate } from '@/shared/utils';

const ADELAIDE_TIME_ZONE = 'Australia/Adelaide';

function adelaideCalendarDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ADELAIDE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function sessionDateLabel(date: string): string {
  return formatDate(new Date(`${date}T12:00:00`));
}

/**
 * Enrolment can begin on the latest session that has already started, or on any later session.
 * Older past sessions stay hidden.
 */
export function enrollmentStartDateOptions(
  sessions: Array<{ start_at: string | null }>,
  now = new Date(),
): Array<{ value: string; label: string }> {
  const today = adelaideCalendarDate(now);
  const dated = sessions.flatMap((session) => {
    if (!session.start_at) return [];
    const startAt = new Date(session.start_at);
    if (Number.isNaN(startAt.getTime())) return [];
    return [{ startAt, date: adelaideCalendarDate(startAt) }];
  }).sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

  const mostRecentPast = [...dated].reverse().find((session) => session.startAt.getTime() <= now.getTime());
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  if (mostRecentPast && mostRecentPast.date < today) {
    seen.add(mostRecentPast.date);
    options.push({
      value: mostRecentPast.date,
      label: `${sessionDateLabel(mostRecentPast.date)} (Most recent past)`,
    });
  }

  for (const session of dated) {
    if (session.date < today || seen.has(session.date)) continue;
    seen.add(session.date);
    options.push({ value: session.date, label: sessionDateLabel(session.date) });
  }

  return options;
}
