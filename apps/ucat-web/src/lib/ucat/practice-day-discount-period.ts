/** Calendar date YYYY-MM-DD in an IANA timezone. */
export function localDateStringInTimezone(
  instant: Date,
  timezone: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(instant);
}

export function todayLocalDateString(timezone: string): string {
  return localDateStringInTimezone(new Date(), timezone);
}

/** Whether a credit_date falls within a billing period (inclusive, student timezone). */
export function isCreditDateInBillingPeriod(
  creditDate: string,
  periodStartIso: string | null,
  periodEndIso: string | null,
  timezone: string,
): boolean {
  if (!periodStartIso || !periodEndIso) return false;
  const startDate = localDateStringInTimezone(new Date(periodStartIso), timezone);
  const endDate = localDateStringInTimezone(new Date(periodEndIso), timezone);
  return creditDate >= startDate && creditDate <= endDate;
}
