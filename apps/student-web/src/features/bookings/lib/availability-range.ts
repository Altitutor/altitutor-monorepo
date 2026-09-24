export const MAX_AVAILABILITY_RANGE_DAYS = 31;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseUtcDate(isoDate: string): Date | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function availabilityRangeDays(startDate: string, endDate: string): number {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (!start || !end) return Number.NaN;
  return (end.getTime() - start.getTime()) / 86_400_000;
}

export function isValidAvailabilityDateRange(startDate: string, endDate: string): boolean {
  const rangeDays = availabilityRangeDays(startDate, endDate);
  return Number.isFinite(rangeDays) && rangeDays >= 0 && rangeDays <= MAX_AVAILABILITY_RANGE_DAYS;
}

function addCalendarDays(isoDate: string, days: number): string {
  const date = parseUtcDate(isoDate);
  if (!date) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function splitDateRangeIntoWindows(
  startDate: string,
  endDate: string,
  maxRangeDays: number = MAX_AVAILABILITY_RANGE_DAYS,
): Array<{ start_date: string; end_date: string }> {
  const rangeDays = availabilityRangeDays(startDate, endDate);
  if (!Number.isFinite(rangeDays) || rangeDays < 0 || maxRangeDays < 0) {
    return [];
  }

  const windows: Array<{ start_date: string; end_date: string }> = [];
  let windowStart = startDate;
  while (availabilityRangeDays(windowStart, endDate) > maxRangeDays) {
    const windowEnd = addCalendarDays(windowStart, maxRangeDays);
    windows.push({ start_date: windowStart, end_date: windowEnd });
    windowStart = addCalendarDays(windowEnd, 1);
  }
  windows.push({ start_date: windowStart, end_date: endDate });
  return windows;
}
