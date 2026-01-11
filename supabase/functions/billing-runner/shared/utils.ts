// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

/**
 * Calculate gross amount with fees
 */
export function grossUp(
  net: number,
  isInternational: boolean,
  percentDomestic: number,
  percentIntl: number,
  fixedCents: number
): number {
  const percent = isInternational ? percentIntl : percentDomestic;
  return Math.round((net + fixedCents) / (1 - percent));
}

/**
 * Format session date in Australia/Adelaide timezone
 */
export function formatSessionDate(startAt: string): string {
  try {
    const date = new Date(startAt);
    // Format in Australia/Adelaide timezone
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Adelaide',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return startAt;
  }
}

/**
 * Build class long name from session, class, and subject data
 */
export function getClassLongName(
  session: any,
  classById: Record<string, any>,
  subjectById: Record<string, any>
): string {
  const cls = session.class_id ? classById[session.class_id] : null;
  const subj = session.subject_id ? subjectById[session.subject_id] : null;
  if (!subj) return 'Session';

  const parts: string[] = [];
  if (subj.curriculum) parts.push(String(subj.curriculum));
  if (subj.year_level != null) parts.push(String(subj.year_level));
  if (subj.name) parts.push(subj.name);
  if (cls?.level) parts.push(String(cls.level));
  return parts.length > 0 ? parts.join(' ') : subj.name || 'Session';
}

/**
 * Calculate Adelaide timezone date range for a given date
 * Returns UTC ISO strings that cover the entire Adelaide day
 */
export function calculateAdelaideDateRange(targetDate: Date): {
  startIso: string;
  endIso: string;
} {
  // Convert target date to Adelaide timezone to get the correct date range
  // Sessions are stored in UTC, but we want to filter by Adelaide date
  // Adelaide is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
  // For January, Adelaide uses ACDT (UTC+10:30)
  // Example: 03/01/2026 Adelaide = 2026-01-02 13:30:00 UTC to 2026-01-03 13:29:59 UTC

  const year = targetDate.getUTCFullYear();
  const month = targetDate.getUTCMonth();
  const day = targetDate.getUTCDate();

  // Calculate UTC range that covers the entire Adelaide day
  // Start: 00:00:00 Adelaide = 13:30:00 previous day UTC (UTC+10:30)
  // End: 23:59:59.999 Adelaide = 13:29:59.999 same day UTC
  const adelaideOffsetMs = 10.5 * 60 * 60 * 1000; // 10.5 hours in milliseconds

  // Start of day in Adelaide (00:00:00 Adelaide time)
  const startAdelaide = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const startUTC = new Date(startAdelaide.getTime() - adelaideOffsetMs);

  // End of day in Adelaide (23:59:59.999 Adelaide time)
  const endAdelaide = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  const endUTC = new Date(endAdelaide.getTime() - adelaideOffsetMs);

  return { startIso: startUTC.toISOString(), endIso: endUTC.toISOString() };
}

/**
 * Generate idempotency key for invoice
 */
export function generateInvoiceIdempotencyKey(
  studentId: string,
  invoiceDate: string,
  timestamp: number
): string {
  return `invoice_${studentId}_${invoiceDate}_${timestamp}`;
}

/**
 * Generate idempotency key for invoice item
 */
export function generateInvoiceItemIdempotencyKey(
  item: any,
  studentId: string,
  invoiceDate: string,
  timestamp: number
): string {
  if (item.sessions_students_id) {
    // For session items, include amount and description hash for uniqueness
    const hash = `${item.amount_cents}_${item.description.substring(0, 50)}`.replace(
      /[^a-zA-Z0-9_]/g,
      '_'
    );
    return `invoice_item_${item.sessions_students_id}_${hash.substring(0, 80)}_${timestamp}`;
  } else {
    // For fee items, include amount and timestamp in key
    return `invoice_item_fee_${studentId}_${invoiceDate}_${item.amount_cents}_${timestamp}`;
  }
}
