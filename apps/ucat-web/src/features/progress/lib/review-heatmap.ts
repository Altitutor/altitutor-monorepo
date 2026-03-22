/**
 * Build a GitHub-style contribution grid from question + set attempt timestamps.
 * Uses the viewer's local calendar day for bucketing.
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

/** Sunday (0) .. Saturday (6), local */
export function getSundayOnOrBefore(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
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

/**
 * Columns are weeks (oldest → newest). Each column is Sun → Sat (index 0 = Sunday).
 */
export function buildReviewHeatmapWeeks(
  now: Date,
  input: ReviewHeatmapInput,
  weekCount: number = DEFAULT_WEEK_COUNT,
): HeatmapDay[][] {
  const end = startOfLocalDay(now);
  const countsByDay = aggregateDailyActivity(input);
  const lastSunday = getSundayOnOrBefore(end);
  const firstSunday = addLocalDays(lastSunday, -(weekCount - 1) * 7);

  const columns: HeatmapDay[][] = [];

  for (let col = 0; col < weekCount; col++) {
    const column: HeatmapDay[] = [];
    for (let row = 0; row < 7; row++) {
      const d = addLocalDays(firstSunday, col * 7 + row);
      const dateKey = localDateKey(d);
      const isFuture = d.getTime() > end.getTime();
      const fromMap = countsByDay.get(dateKey);
      column.push({
        dateKey,
        questionAttempts: isFuture ? 0 : (fromMap?.questionAttempts ?? 0),
        setAttempts: isFuture ? 0 : (fromMap?.setAttempts ?? 0),
        isFuture,
      });
    }
    columns.push(column);
  }

  return columns;
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
