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
 * Return the calendar date (YYYY-MM-DD) for a timestamp in Australia/Adelaide.
 * Use this for invoice_date so it matches the session date in Adelaide, not UTC.
 */
export function getAdelaideDateString(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
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
interface SessionLike {
  class_id?: string | null;
  subject_id?: string | null;
}

interface ClassLike {
  level?: string | number | null;
}

interface SubjectLike {
  curriculum?: string | null;
  year_level?: number | null;
  name?: string | null;
}

export function getClassLongName(
  session: SessionLike,
  classById: Record<string, ClassLike>,
  subjectById: Record<string, SubjectLike>
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
 * Generate idempotency key for invoice.
 *
 * The key is primarily derived from the business identity of the invoice:
 * - studentId
 * - invoiceDate (billing day)
 * - sessionsStudentsIds (set of sessions in the invoice, if available)
 *
 * For session-based invoices (billing-single and billing-runner), this makes
 * the key stable per (student, date, sessions_students set) so that retries
 * and double-calls reuse the same Stripe invoice instead of creating new ones.
 *
 * When no sessionsStudentsIds are provided (e.g. legacy or non-session
 * invoices), an optional timestamp can be supplied as a tiebreaker to avoid
 * collisions.
 */
export function generateInvoiceIdempotencyKey(
  studentId: string,
  invoiceDate: string,
  options?: {
    sessionsStudentsIds?: string[];
    timestamp?: number;
  }
): string {
  const base = `invoice_${studentId}_${invoiceDate}`;

  const ids = options?.sessionsStudentsIds;
  if (ids && ids.length > 0) {
    const sorted = [...ids].sort();
    return `${base}_${sorted.join('-')}`;
  }

  if (options?.timestamp != null) {
    return `${base}_${options.timestamp}`;
  }

  return base;
}

/**
 * Generate idempotency key for invoice item
 */
interface InvoiceItemLike {
  sessions_students_id?: string;
  session_id?: string;
  amount_cents: number;
  description: string;
  is_fee?: boolean;
  is_subsidy?: boolean;
}

/**
 * Generate idempotency key for invoice item.
 *
 * For session-based items (with sessions_students_id), the key is stable per
 * (sessions_students_id, is_fee, is_subsidy, amount_cents, invoiceDate).
 * This ensures retries or double-calls reuse the same Stripe invoice item
 * instead of creating duplicates.
 *
 * For fee-only items that are not tied to a specific sessions_students_id,
 * we continue to allow a timestamp tiebreaker so multiple distinct fee items
 * can coexist on the same invoice.
 */
export function generateInvoiceItemIdempotencyKey(
  item: InvoiceItemLike,
  studentId: string,
  invoiceDate: string,
  timestamp?: number
): string {
  if (item.sessions_students_id) {
    const flags = [
      item.is_fee ? 'fee' : 'main',
      item.is_subsidy ? 'subsidy' : 'charge',
    ].join('-');
    return `invoice_item_${item.sessions_students_id}_${flags}_${item.amount_cents}_${invoiceDate}`;
  }

  const effectiveTimestamp = timestamp ?? Date.now();
  return `invoice_item_fee_${studentId}_${invoiceDate}_${item.amount_cents}_${effectiveTimestamp}`;
}

