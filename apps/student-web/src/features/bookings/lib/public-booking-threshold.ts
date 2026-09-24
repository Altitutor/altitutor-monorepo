/**
 * Adelaide calendar-date helpers for public booking change/cancel thresholds.
 * Matches get_available_slots min_advance_booking_days semantics.
 */

export function getAdelaideDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns true when the session is too soon to change/cancel under
 * min_advance_booking_days (Adelaide calendar dates).
 */
export function isWithinMinAdvanceThreshold(
  sessionStartAtIso: string,
  minAdvanceDays: number,
  now: Date = new Date()
): boolean {
  const todayAdelaide = getAdelaideDateString(now);
  const sessionAdelaide = getAdelaideDateString(new Date(sessionStartAtIso));

  const today = new Date(`${todayAdelaide}T00:00:00`);
  const minAllowed = new Date(today);
  minAllowed.setDate(minAllowed.getDate() + minAdvanceDays);

  return sessionAdelaide < getAdelaideDateString(minAllowed);
}
