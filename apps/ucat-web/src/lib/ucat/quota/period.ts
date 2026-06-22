import type { UcatQuotaPeriod } from "@/features/ucat-access/types/quota";

/**
 * Period start in UTC for quota counting, aligned to student timezone.
 * Week uses ISO Monday start.
 */
export function getQuotaPeriodStart(
  period: UcatQuotaPeriod,
  timezone: string,
  at: Date = new Date(),
): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(at);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  if (period === "day") {
    return zonedMidnightUtc(y, m, d, timezone);
  }

  if (period === "week") {
    const local = new Date(Date.UTC(y, m - 1, d));
    const isoDow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const monday = new Date(Date.UTC(y, m - 1, d - (isoDow - 1)));
    return zonedMidnightUtc(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
      timezone,
    );
  }

  return zonedMidnightUtc(y, m, 1, timezone);
}

function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timezone: string,
): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let candidateMs =
    targetAsUtc - getTimezoneOffsetMs(new Date(targetAsUtc), timezone);
  const seen = new Set<number>();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isLocalMidnight(candidateMs, year, month, day, timezone)) {
      return new Date(candidateMs);
    }

    seen.add(candidateMs);
    const nextMs =
      targetAsUtc - getTimezoneOffsetMs(new Date(candidateMs), timezone);
    if (nextMs === candidateMs || seen.has(nextMs)) break;
    candidateMs = nextMs;
  }

  // Midnight can be skipped when DST starts at 00:00. Match PostgreSQL's
  // `timestamp AT TIME ZONE` behavior by using the first instant on that date.
  return new Date(
    findFirstInstantForLocalDate(year, month, day, timezone, targetAsUtc),
  );
}

function isLocalMidnight(
  instantMs: number,
  year: number,
  month: number,
  day: number,
  timezone: string,
): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return (
    read("year") === year &&
    read("month") === month &&
    read("day") === day &&
    read("hour") === 0 &&
    read("minute") === 0
  );
}

function findFirstInstantForLocalDate(
  year: number,
  month: number,
  day: number,
  timezone: string,
  targetAsUtc: number,
): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const targetDateOrdinal = Date.UTC(year, month - 1, day);
  const localDateOrdinal = (instantMs: number) => {
    const parts = formatter.formatToParts(new Date(instantMs));
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(read("year"), read("month") - 1, read("day"));
  };

  let low = targetAsUtc - 48 * 60 * 60 * 1000;
  let high = targetAsUtc + 48 * 60 * 60 * 1000;

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDateOrdinal(middle) >= targetDateOrdinal) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utc = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (parts: Intl.DateTimeFormatPart[]) => ({
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
    // Some locales render midnight as 24:00 for the same calendar date.
    h: normalizeHour(Number(parts.find((p) => p.type === "hour")?.value)),
    min: Number(parts.find((p) => p.type === "minute")?.value),
  });

  const u = read(utc);
  const l = read(local);
  const utcMs = Date.UTC(u.y, u.m - 1, u.d, u.h, u.min);
  const localAsUtcMs = Date.UTC(l.y, l.m - 1, l.d, l.h, l.min);
  return localAsUtcMs - utcMs;
}

function normalizeHour(hour: number): number {
  return hour === 24 ? 0 : hour;
}

export function formatQuotaPeriodLabel(period: UcatQuotaPeriod): string {
  switch (period) {
    case "day":
      return "today";
    case "week":
      return "this week";
    case "month":
      return "this month";
  }
}
