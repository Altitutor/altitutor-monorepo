const TIME_ZONE = 'Australia/Adelaide';

export function adelaideDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function startOfAdelaideDay(now = new Date()): Date {
  const [year, month, day] = adelaideDateKey(now).split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const wall = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMidnight));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(wall.find((item) => item.type === type)?.value);
  const wallAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return new Date(utcMidnight - (wallAsUtc - utcMidnight));
}

export function selectTimetableSessions<T extends { start_at: string | null }>(
  sessions: T[],
  now = new Date(),
): { heading: 'Today' | 'Next session'; sessions: T[] } {
  const today = adelaideDateKey(now);
  const todaySessions = sessions.filter((session) => {
    if (!session.start_at) return false;
    return adelaideDateKey(new Date(session.start_at)) === today;
  });
  if (todaySessions.length > 0) return { heading: 'Today', sessions: todaySessions };
  const next = sessions.find((session) => session.start_at && new Date(session.start_at).getTime() > now.getTime());
  return { heading: 'Next session', sessions: next ? [next] : [] };
}
