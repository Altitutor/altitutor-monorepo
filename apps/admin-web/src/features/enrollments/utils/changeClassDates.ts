export interface ChangeClassSessionDate {
  calendarDate: string;
  logged: boolean;
  studentAttended: boolean;
}

/** UTC instant of midnight on a calendar date in an IANA timezone. */
export function zonedMidnight(calendarDate: string, timeZone: string): Date {
  const utcGuess = new Date(`${calendarDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcGuess);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const zonedAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime()));
}

function nextCalendarDate(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** Matches change_student_class: the day after the final lesson, at midnight in the class timezone, must be after enrolled_at. */
export function finalClassDateIsAfterEnrolment(lastClassDate: string, enrolledAt: string, timeZone: string): boolean {
  return zonedMidnight(nextCalendarDate(lastClassDate), timeZone).getTime() > new Date(enrolledAt).getTime();
}

export function mondayOfCalendarDate(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function selectableLastOldClassDates({
  sessions,
  enrolledAt,
  timezone,
}: {
  sessions: ChangeClassSessionDate[];
  enrolledAt: string | null;
  timezone: string;
}): string[] {
  const committed = sessions
    .filter((session) => session.logged || session.studentAttended)
    .map((session) => session.calendarDate);
  const floor = committed.sort().at(-1) ?? null;
  return [...new Set(sessions.map((session) => session.calendarDate))]
    .filter((date) => (!floor || date >= floor) && (!enrolledAt || finalClassDateIsAfterEnrolment(date, enrolledAt, timezone)))
    .sort();
}

export function firstNewClassWarnings({
  firstNewDate,
  today,
  keptOldDates,
  newClassDates,
}: {
  firstNewDate: string;
  today: string;
  keptOldDates: string[];
  newClassDates: string[];
}): { past: boolean; sameWeek: boolean } {
  const oldWeeks = new Set(keptOldDates.map(mondayOfCalendarDate));
  const newDates = newClassDates.filter((date) => date >= firstNewDate);
  return {
    past: firstNewDate < today,
    sameWeek: newDates.some((date) => oldWeeks.has(mondayOfCalendarDate(date))),
  };
}
