export type CalendarDay = {
  dateKey: string;
  dayNumber: number;
};

export type CalendarMonth = {
  key: string;
  label: string;
  days: (CalendarDay | null)[];
};

export type ActivityIntensityLevel = 0 | 1 | 2 | 3 | 4;

export const ACTIVITY_INTENSITY_ALPHA: Record<ActivityIntensityLevel, number> =
  {
    0: 0.08,
    1: 0.25,
    2: 0.45,
    3: 0.65,
    4: 0.85,
  };

/**
 * Maps a day's total against the busiest day in the same month.
 * Keeps empty days at 0 and spreads active days across 1–4.
 */
export function relativeActivityIntensityLevel(
  total: number,
  monthMax: number,
): ActivityIntensityLevel {
  if (total <= 0 || monthMax <= 0) return 0;
  const ratio = total / monthMax;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToLocalDate(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthStart(dateKey: string): Date | null {
  const date = dateKeyToLocalDate(dateKey);
  return date ? new Date(date.getFullYear(), date.getMonth(), 1) : null;
}

function buildCalendarMonth(date: Date): CalendarMonth {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const days: (CalendarDay | null)[] = Array.from(
    { length: 42 },
    (_, index) => {
      const dayNumber = index - leadingBlanks + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return {
        dayNumber,
        dateKey: localDateKey(new Date(year, month, dayNumber)),
      };
    },
  );

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: first.toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric",
    }),
    days,
  };
}

export function buildActivityCalendarMonths(
  startDateKey: string,
  endDateKey: string,
): CalendarMonth[] {
  const start = monthStart(startDateKey);
  const end = monthStart(endDateKey);
  if (!start || !end) return [];
  if (start.getTime() > end.getTime()) return [buildCalendarMonth(start)];

  const months: CalendarMonth[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime() && months.length < 48;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    months.push(buildCalendarMonth(cursor));
  }
  return months;
}

export function activityCalendarStartKey(
  dayKeys: string[],
  startedAt: string | null,
  todayKey: string,
): string {
  const keys = [...dayKeys];
  const startedKey = startedAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (startedKey) keys.push(startedKey);
  keys.sort();
  return keys[0] ?? todayKey;
}

export function monthActivityMaxima(
  days: { dateKey: string; questionAttempts: number; setAttempts: number }[],
): Map<string, number> {
  const maxima = new Map<string, number>();
  for (const day of days) {
    const total = day.questionAttempts + day.setAttempts;
    if (total <= 0) continue;
    const monthKey = day.dateKey.slice(0, 7);
    maxima.set(monthKey, Math.max(maxima.get(monthKey) ?? 0, total));
  }
  return maxima;
}
