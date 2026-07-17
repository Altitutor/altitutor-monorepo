export type UcatCalendarDay = {
  dateKey: string;
  dayNumber: number;
};

export type UcatCalendarMonth = {
  key: string;
  label: string;
  days: Array<UcatCalendarDay | null>;
};

export type ActivityIntensityLevel = 0 | 1 | 2 | 3 | 4;

/** Shared primary-opacity scale for activity surfaces (calendar cells, legends). */
export const ACTIVITY_INTENSITY_CLASS: Record<ActivityIntensityLevel, string> = {
  0: "bg-primary/5",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/65",
  4: "bg-primary/85",
};

/** 0 = no activity, 1–4 increasing intensity (by combined attempts). */
export function activityIntensityLevel(total: number): ActivityIntensityLevel {
  if (total <= 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  if (total <= 9) return 3;
  return 4;
}

function dateParts(dateKey: string): [number, number, number] | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return [year, month, day];
}

export function dateKeyToLocalDate(dateKey: string): Date | null {
  const parts = dateParts(dateKey);
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatUcatCalendarDate(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = dateKeyToLocalDate(dateKey);
  return date?.toLocaleDateString("en-AU", options) ?? dateKey;
}

function monthStart(dateKey: string): Date | null {
  const date = dateKeyToLocalDate(dateKey);
  return date ? new Date(date.getFullYear(), date.getMonth(), 1) : null;
}

function buildCalendarMonth(date: Date): UcatCalendarMonth {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const days: Array<UcatCalendarDay | null> = Array.from(
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

export function buildUcatCalendarMonths(
  startDateKey: string,
  endDateKey: string,
): UcatCalendarMonth[] {
  const start = monthStart(startDateKey);
  const end = monthStart(endDateKey);
  if (!start || !end) return [];
  if (start.getTime() > end.getTime()) return [buildCalendarMonth(start)];

  const months: UcatCalendarMonth[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime() && months.length < 48;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    months.push(buildCalendarMonth(cursor));
  }
  return months;
}
