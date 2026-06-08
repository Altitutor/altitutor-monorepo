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
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMs = getTimezoneOffsetMs(guess, timezone);
  return new Date(guess.getTime() - offsetMs);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utc = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (parts: Intl.DateTimeFormatPart[]) => ({
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
    h: Number(parts.find((p) => p.type === "hour")?.value),
  });

  const u = read(utc);
  const l = read(local);
  const utcMs = Date.UTC(u.y, u.m - 1, u.d, u.h);
  const localAsUtcMs = Date.UTC(l.y, l.m - 1, l.d, l.h);
  return localAsUtcMs - utcMs;
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
