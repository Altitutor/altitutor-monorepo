export type PracticeStreakDay = {
  dateKey: string;
  practiced: boolean;
  isToday: boolean;
};

export type PracticeStreakSummary = {
  current: number;
  practicedToday: boolean;
  recentDays: PracticeStreakDay[];
};

function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

/** A practice streak is one or more submitted questions on consecutive local days. */
export function buildPracticeStreak(
  activityDays: { dateKey: string; questionAttempts: number }[],
  timezone: string,
  now = new Date(),
): PracticeStreakSummary {
  const today = dateKeyInTimezone(now, timezone);
  const practicedDates = new Set(
    activityDays
      .filter((day) => day.questionAttempts > 0)
      .map((day) => day.dateKey),
  );
  const practicedToday = practicedDates.has(today);
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const dateKey = shiftDateKey(today, index - 6);
    return {
      dateKey,
      practiced: practicedDates.has(dateKey),
      isToday: dateKey === today,
    };
  });

  // A streak remains current throughout today, giving the student the full
  // local calendar day to extend it.
  let cursor = practicedToday ? today : shiftDateKey(today, -1);
  let current = 0;
  while (practicedDates.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return { current, practicedToday, recentDays };
}

export function practiceStreakWeekday(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { weekday: "narrow" }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
}
