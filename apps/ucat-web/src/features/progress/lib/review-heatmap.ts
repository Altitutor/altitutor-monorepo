/**
 * Build a contribution-style grid from question + set attempt timestamps.
 * Uses local calendar days; weeks start Monday (row order Mon → Sun).
 */

export type HeatmapDay = {
  dateKey: string;
  questionAttempts: number;
  setAttempts: number;
  /** After "today" in the current week — show empty cell */
  isFuture: boolean;
};

export type ReviewHeatmapInput = {
  questionAttempts: ReadonlyArray<{ attemptedAt: string }>;
  setAttempts: ReadonlyArray<{
    attemptedAt: string;
    completedAt: string | null;
  }>;
};

export type HeatmapCell =
  | { kind: "day"; day: HeatmapDay }
  | { kind: "blank" };

/** One vertical strip: seven rows, index 0 = Monday … 6 = Sunday */
export type HeatmapWeekColumn = {
  cells: HeatmapCell[];
  /** Calendar month this column belongs to (YYYY-MM) */
  monthKey: string;
};

export type HeatmapMonthGroup = {
  monthKey: string;
  label: string;
  columns: HeatmapWeekColumn[];
};

const DEFAULT_WEEK_COUNT = 53;

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoTimestampToLocalDateKey(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return localDateKey(d);
}

export function addLocalDays(base: Date, days: number): Date {
  const d = startOfLocalDay(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday of the week containing `d`, local */
export function getMondayOnOrBefore(d: Date): Date {
  const x = startOfLocalDay(d);
  const js = x.getDay(); // 0 Sun .. 6 Sat
  const daysFromMonday = js === 0 ? 6 : js - 1;
  x.setDate(x.getDate() - daysFromMonday);
  return x;
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function aggregateDailyActivity(
  input: ReviewHeatmapInput,
): Map<string, { questionAttempts: number; setAttempts: number }> {
  const map = new Map<string, { questionAttempts: number; setAttempts: number }>();

  const bump = (
    key: string,
    field: "questionAttempts" | "setAttempts",
  ): void => {
    const cur = map.get(key) ?? { questionAttempts: 0, setAttempts: 0 };
    cur[field] += 1;
    map.set(key, cur);
  };

  for (const a of input.questionAttempts) {
    const key = isoTimestampToLocalDateKey(a.attemptedAt);
    if (key) bump(key, "questionAttempts");
  }

  for (const a of input.setAttempts) {
    const raw = a.completedAt ?? a.attemptedAt;
    const key = isoTimestampToLocalDateKey(raw);
    if (key) bump(key, "setAttempts");
  }

  return map;
}

function buildHeatmapDay(
  d: Date,
  end: Date,
  countsByDay: Map<string, { questionAttempts: number; setAttempts: number }>,
): HeatmapDay {
  const dateKey = localDateKey(d);
  const isFuture = d.getTime() > end.getTime();
  const fromMap = countsByDay.get(dateKey);
  return {
    dateKey,
    questionAttempts: isFuture ? 0 : (fromMap?.questionAttempts ?? 0),
    setAttempts: isFuture ? 0 : (fromMap?.setAttempts ?? 0),
    isFuture,
  };
}

function uniqueSortedMonthKeys(days: HeatmapDay[]): string[] {
  return [...new Set(days.map((d) => monthKeyFromDateKey(d.dateKey)))].sort();
}

function columnForMonthSlice(
  daysMonToSun: HeatmapDay[],
  targetMonthKey: string,
): HeatmapWeekColumn {
  const cells: HeatmapCell[] = daysMonToSun.map((day) => {
    if (monthKeyFromDateKey(day.dateKey) === targetMonthKey) {
      return { kind: "day", day };
    }
    return { kind: "blank" };
  });
  return { cells, monthKey: targetMonthKey };
}

/** Split a Mon–Sun week into one or two columns if it crosses a month boundary */
export function expandWeekToColumns(daysMonToSun: HeatmapDay[]): HeatmapWeekColumn[] {
  const monthKeys = uniqueSortedMonthKeys(daysMonToSun);
  if (monthKeys.length <= 1) {
    const mk = monthKeys[0] ?? monthKeyFromDateKey(daysMonToSun[0].dateKey);
    return [
      {
        cells: daysMonToSun.map((day) => ({ kind: "day" as const, day })),
        monthKey: mk,
      },
    ];
  }
  return monthKeys.map((mk) => columnForMonthSlice(daysMonToSun, mk));
}

export function groupColumnsByMonth(
  columns: HeatmapWeekColumn[],
): HeatmapMonthGroup[] {
  const groups: HeatmapMonthGroup[] = [];
  for (const col of columns) {
    const last = groups[groups.length - 1];
    if (last && last.monthKey === col.monthKey) {
      last.columns.push(col);
    } else {
      groups.push({
        monthKey: col.monthKey,
        label: formatMonthAxisLabel(col.monthKey),
        columns: [col],
      });
    }
  }
  return groups;
}

export function formatMonthAxisLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Month clusters (oldest → newest), each with week columns.
 * Weeks start Monday; columns that span two months are split.
 */
export function buildReviewHeatmapModel(
  now: Date,
  input: ReviewHeatmapInput,
  weekCount: number = DEFAULT_WEEK_COUNT,
): HeatmapMonthGroup[] {
  const end = startOfLocalDay(now);
  const countsByDay = aggregateDailyActivity(input);
  const lastMonday = getMondayOnOrBefore(end);
  const firstMonday = addLocalDays(lastMonday, -(weekCount - 1) * 7);

  const flat: HeatmapWeekColumn[] = [];
  for (
    let w = new Date(firstMonday);
    w.getTime() <= lastMonday.getTime();
    w = addLocalDays(w, 7)
  ) {
    const days: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(buildHeatmapDay(addLocalDays(w, i), end, countsByDay));
    }
    flat.push(...expandWeekToColumns(days));
  }

  return groupColumnsByMonth(flat);
}

/** 0 = no activity, 1–4 increasing intensity (by combined attempts). */
export function reviewHeatmapIntensityLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  if (total <= 9) return 3;
  return 4;
}

export function formatHeatmapDayLabel(dateKey: string): string {
  const [y, m, day] = dateKey.split("-").map(Number);
  if (!y || !m || !day) return dateKey;
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
