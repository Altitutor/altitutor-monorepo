import { formatDate } from '@/shared/utils/datetime';

type Snapshot = Record<string, unknown>;

function record(value: unknown): Snapshot {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Snapshot
    : {};
}

function label(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function rate(subsidy: Snapshot): string {
  const amount = subsidy.price_cents;
  return typeof amount === 'number' && Number.isFinite(amount)
    ? `${(amount / 100).toFixed(2)} ${label(subsidy.currency, 'AUD').toUpperCase()}/hour`
    : 'unspecified rate';
}

function subject(subsidy: Snapshot): string {
  const billingType = label(subsidy.billing_type, 'CLASS').replace(/_/g, ' ').toLowerCase();
  return `${label(subsidy.subject_name, 'the subject')} (${billingType})`;
}

function date(value: unknown): string {
  return typeof value === 'string' ? formatDate(value) || value : 'indefinitely';
}

function window(subsidy: Snapshot): string {
  const start = date(subsidy.effective_from);
  return subsidy.effective_until == null
    ? `from ${start}, indefinitely`
    : `${start} to ${date(subsidy.effective_until)}`;
}

function describe(value: unknown): string {
  const subsidy = record(value);
  return `${subject(subsidy)} at ${rate(subsidy)} (${window(subsidy)})`;
}

export function subsidyActivityMessage(eventName: string, student: string, payload: Snapshot): string {
  const before = record(payload.before);
  const after = record(payload.after);
  let message: string;
  if (eventName === 'student.subsidy_added') {
    message = `added a subsidy for ${student}: ${describe(payload.after)}`;
  } else if (eventName === 'student.subsidy_removed') {
    message = `removed a subsidy for ${student}: ${describe(payload.before)}`;
  } else {
    const changes: string[] = [];
    if (before.subject_id !== after.subject_id || before.billing_type !== after.billing_type) {
      changes.push(`subject from ${subject(before)} to ${subject(after)}`);
    }
    if (before.price_cents !== after.price_cents || before.currency !== after.currency) {
      changes.push(`hourly rate from ${rate(before)} to ${rate(after)}`);
    }
    if (before.effective_from !== after.effective_from) {
      changes.push(`start from ${date(before.effective_from)} to ${date(after.effective_from)}`);
    }
    if (before.effective_until !== after.effective_until) {
      changes.push(`end from ${date(before.effective_until)} to ${date(after.effective_until)}`);
    }
    if (before.student_id !== after.student_id) changes.push(`assigned to ${student}`);
    message = `changed the subsidy for ${student}: ${subject(after)}`;
    if (changes.length) message += `; ${changes.join('; ')}`;
  }

  // Show the real financial effects of replacement/splitting without presenting
  // the resumed range as an independently added subsidy.
  const affected = Array.isArray(payload.affected_subsidies) ? payload.affected_subsidies : [];
  const adjustments = affected.map((value) => {
    const change = record(value);
    if (change.before == null) return `resumed ${describe(change.after)}`;
    if (change.after == null) return `replaced ${describe(change.before)}`;
    return `adjusted ${describe(change.before)} to ${describe(change.after)}`;
  });
  return adjustments.length ? `${message}; ${adjustments.join('; ')}` : message;
}
