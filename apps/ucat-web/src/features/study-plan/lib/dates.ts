import type { StudyPlanWeekday } from "@/features/study-plan/model/types";

const DAY_MS = 86_400_000;

export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || isoDate(date) !== value) {
    throw new Error("Invalid date");
  }
  return date;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS,
  );
}

export function weekday(value: string): StudyPlanWeekday {
  return parseIsoDate(value).getUTCDay() as StudyPlanWeekday;
}

export function midpointDate(startsOn: string, endsOn: string): string {
  return addDays(startsOn, Math.max(0, Math.floor(daysBetween(startsOn, endsOn) / 2)));
}

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
