import type { SubjectPricingOverrideRow } from '@/features/billing/api/subject-pricing-overrides';
import type { StudentSubsidyRow } from '@/features/students/api/subsidies';

/**
 * Calculate session price based on billing type, subject, and student subsidies
 * This mirrors the logic from supabase/functions/billing-runner/shared/pricing.ts
 * Returns { amount_cents, currency }
 */
export function calculateSessionPrice(
  session: {
    billing_type: string | null;
    subject_id: string;
    start_at: string;
    end_at: string;
  },
  studentId: string | undefined,
  targetDate: Date,
  pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }>,
  overridesBySubjectAndBilling: Record<string, Record<string, { hourly_rate_cents: number; currency: string }>>,
  pricingOverrides: SubjectPricingOverrideRow[],
  subsidies: StudentSubsidyRow[]
): { amount_cents: number; currency: string } {
  if (!session.billing_type) {
    return { amount_cents: 0, currency: 'aud' };
  }

  const startTime = new Date(session.start_at).getTime();
  const endTime = new Date(session.end_at).getTime();
  const durationMs = endTime - startTime;
  const durationHours = durationMs / (1000 * 60 * 60);

  const override = overridesBySubjectAndBilling[session.subject_id]?.[session.billing_type];
  let hourlyRateCents = 0;
  let currency = 'aud';

  if (override) {
    const overrideData = pricingOverrides?.find(
      (o: SubjectPricingOverrideRow) =>
        o.subject_id === session.subject_id && o.billing_type === session.billing_type
    );
    if (overrideData) {
      const effectiveFrom = new Date(overrideData.effective_from);
      const effectiveUntil = overrideData.effective_until
        ? new Date(overrideData.effective_until)
        : null;
      if (effectiveFrom <= targetDate && (!effectiveUntil || effectiveUntil > targetDate)) {
        hourlyRateCents = override.hourly_rate_cents;
        currency = override.currency.toLowerCase();
      } else {
        const defaultPricing = pricingByBillingType[session.billing_type];
        hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
        currency = defaultPricing?.currency?.toLowerCase() || 'aud';
      }
    } else {
      const defaultPricing = pricingByBillingType[session.billing_type];
      hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
      currency = defaultPricing?.currency?.toLowerCase() || 'aud';
    }
  } else {
    const defaultPricing = pricingByBillingType[session.billing_type];
    hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
    currency = defaultPricing?.currency?.toLowerCase() || 'aud';
  }

  if (studentId && session.subject_id && session.billing_type) {
    const activeSub = (subsidies || []).find(
      (s: StudentSubsidyRow) =>
        s.student_id === studentId &&
        s.subject_id === session.subject_id &&
        s.billing_type === session.billing_type &&
        (!s.effective_from || new Date(s.effective_from) <= targetDate) &&
        (!s.effective_until || new Date(s.effective_until) > targetDate)
    );

    if (activeSub) {
      const subsidyHourlyRateCents = activeSub.price_cents;
      hourlyRateCents = Math.min(hourlyRateCents, subsidyHourlyRateCents);
      if (activeSub.currency) {
        currency = activeSub.currency.toLowerCase();
      }
    }
  }

  return {
    amount_cents: Math.round(hourlyRateCents * durationHours),
    currency,
  };
}

/**
 * Format amount in cents to currency string
 */
export function formatCurrency(amountCents: number, currency: string = 'aud'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}
