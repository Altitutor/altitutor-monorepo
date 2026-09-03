import type { Enums, Tables } from '@altitutor/shared';

interface StandardRate {
  hourlyRateCents: number;
  currency: string;
}

function isEffectiveAt(
  override: Tables<'billing_pricing_overrides'>,
  targetDate: Date
): boolean {
  const effectiveFrom = new Date(override.effective_from);
  const effectiveUntil = override.effective_until
    ? new Date(override.effective_until)
    : null;
  return effectiveFrom <= targetDate && (!effectiveUntil || effectiveUntil > targetDate);
}

export function resolveStandardClassRate(
  billingType: Enums<'billing_type'>,
  subjectId: string | null,
  targetDate: Date,
  pricing: Tables<'billing_pricing'>[],
  overrides: Tables<'billing_pricing_overrides'>[]
): StandardRate | null {
  const override = subjectId
    ? overrides
      .filter((candidate) =>
        candidate.subject_id === subjectId &&
        candidate.billing_type === billingType &&
        isEffectiveAt(candidate, targetDate)
      )
      .sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0]
    : undefined;

  if (override) {
    return {
      hourlyRateCents: override.hourly_rate_cents,
      currency: override.currency,
    };
  }

  const defaultRate = pricing.find((candidate) => candidate.billing_type === billingType);
  return defaultRate
    ? {
      hourlyRateCents: defaultRate.hourly_rate_cents,
      currency: defaultRate.currency,
    }
    : null;
}

function minutesSinceMidnight(time: string): number | null {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function calculateStandardClassSessionPrice(
  startTime: string,
  endTime: string,
  rate: StandardRate | null
): { amountCents: number; currency: string } | null {
  if (!rate) return null;
  const startMinutes = minutesSinceMidnight(startTime);
  const endMinutes = minutesSinceMidnight(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;

  return {
    amountCents: Math.round(rate.hourlyRateCents * ((endMinutes - startMinutes) / 60)),
    currency: rate.currency,
  };
}
