import { format } from "date-fns";

/** Progress view mode: all time (simple avg), weighted (EMA), or time frame (filtered) */
export type ProgressMode = "all_time" | "weighted" | "time_frame";

/** Global filter for which attempts to show in progress graphs and tables */
export type AttemptFilter =
  | "all"
  | "timed_sets_and_mocks"
  | "mocks_only";

export const ATTEMPT_FILTER_OPTIONS: {
  value: AttemptFilter;
  label: string;
  infoTooltip: string;
}[] = [
  {
    value: "all",
    label: "All question attempts",
    infoTooltip:
      "Shows every submitted question attempt and all set and mock rows: untimed sets, timed sets, and full mocks. Use this for a complete picture of your practice.",
  },
  {
    value: "timed_sets_and_mocks",
    label: "Timed sets and mocks",
    infoTooltip:
      "Keeps timed standalone question sets and everything from full mock exams (all sections). Untimed-only standalone sets are hidden so the view matches exam-style conditions.",
  },
  {
    value: "mocks_only",
    label: "Mocks only",
    infoTooltip:
      "Only completed mock exams and the question sets inside them. Standalone set practice is hidden so you can focus on mock performance.",
  },
];

export const TIME_FRAME_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export type TimeFrameDays = (typeof TIME_FRAME_OPTIONS)[number]["value"];

/** Bucket size for graph aggregation: daily for ≤45 days, weekly for 90 days */
export function getGraphBucketDays(days: number): "day" | "week" {
  return days <= 45 ? "day" : "week";
}

/** Format a week bucket key (Monday yyyy-MM-dd) as a day range for x-axis display */
export function formatWeekRangeLabel(bucketKey: string): string {
  try {
    const start = new Date(bucketKey + "T12:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = format(start, "MMM d");
    const endStr = format(end, "MMM d");
    return `${startStr} – ${endStr}`;
  } catch {
    return bucketKey;
  }
}

/** Format date as local yyyy-MM-dd (avoids timezone mismatch with getBucketKeysBetween) */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get bucket key for a date (yyyy-MM-dd for day, yyyy-MM-dd of Monday for week). Uses local time. */
export function getBucketKey(
  date: Date | string,
  bucket: "day" | "week",
): string {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  if (bucket === "day") {
    return toLocalDateString(d);
  }
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return toLocalDateString(monday);
}

/** Get all bucket keys in range for graph x-axis */
export function getBucketKeysInRange(
  days: number,
  bucket: "day" | "week",
): string[] {
  const { start, end } = getTimeFrameRange(days);
  return getBucketKeysBetween(start, end, bucket);
}

/** Get bucket keys between two dates. Uses local time to match getBucketKey. */
export function getBucketKeysBetween(
  start: Date,
  end: Date,
  bucket: "day" | "week",
): string[] {
  const keys: string[] = [];
  if (bucket === "day") {
    const d = new Date(start);
    while (d <= end) {
      keys.push(toLocalDateString(d));
      d.setDate(d.getDate() + 1);
    }
  } else {
    const d = new Date(start);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    while (d <= end) {
      keys.push(toLocalDateString(d));
      d.setDate(d.getDate() + 7);
    }
  }
  return keys;
}

/** Get date range for time frame filtering */
export function getTimeFrameRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Check if a date falls within the time frame */
export function isInTimeFrame(date: Date | string, days: number): boolean {
  const { start, end } = getTimeFrameRange(days);
  const d = typeof date === "string" ? new Date(date) : date;
  return d >= start && d <= end;
}
