/**
 * Calculate session price based on billing type, subject, and student subsidies
 * Returns { amount_cents, currency }
 */
interface SessionPricingInput {
  billing_type?: string | null;
  subject_id?: string | null;
  start_at: string;
  end_at: string;
}

interface PricingOverrideRow {
  subject_id: string;
  billing_type: string;
  hourly_rate_cents: number;
  currency: string;
  effective_from: string;
  effective_until?: string | null;
}

interface SubsidyRow {
  student_id: string;
  subject_id: string;
  billing_type: string;
  price_cents: number;
  currency?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
}

export function calculateSessionPrice(
  session: SessionPricingInput,
  studentId: string | undefined,
  targetDate: Date,
  pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }>,
  overridesBySubjectAndBilling: Record<string, Record<string, { hourly_rate_cents: number; currency: string; effective_from: string; effective_until?: string | null }>>,
  pricingOverrides: PricingOverrideRow[],
  subsidies: SubsidyRow[]
): { amount_cents: number; currency: string } {
  if (!session.billing_type) {
    return { amount_cents: 0, currency: 'aud' }; // Non-billable session
  }

  // Calculate duration in hours
  const startTime = new Date(session.start_at).getTime();
  const endTime = new Date(session.end_at).getTime();
  const durationMs = endTime - startTime;
  const durationHours = durationMs / (1000 * 60 * 60);

  // Check for subject override first (use targetDate for override validation)
  const override = overridesBySubjectAndBilling[session.subject_id]?.[session.billing_type];
  let hourlyRateCents = 0;
  let currency = 'aud';

  if (override) {
    // Validate override is active for targetDate
    const overrideData = pricingOverrides?.find(
      (o: PricingOverrideRow) =>
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
        // Override not active, use default pricing
        const defaultPricing = pricingByBillingType[session.billing_type];
        hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
        currency = defaultPricing?.currency?.toLowerCase() || 'aud';
      }
    } else {
      // Override not found in active list, use default
      const defaultPricing = pricingByBillingType[session.billing_type];
      hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
      currency = defaultPricing?.currency?.toLowerCase() || 'aud';
    }
  } else {
    // No override, use default pricing
    const defaultPricing = pricingByBillingType[session.billing_type];
    hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
    currency = defaultPricing?.currency?.toLowerCase() || 'aud';
  }

  // Check for student subsidy (hourly rate override)
  // Subsidies are stored as hourly_rate_cents (price_cents field)
  // Student pays the minimum of subsidy rate and default/override rate
  if (studentId && session.subject_id && session.billing_type) {
    const activeSub = (subsidies || []).find(
      (s: SubsidyRow) =>
        s.student_id === studentId &&
        s.subject_id === session.subject_id &&
        s.billing_type === session.billing_type &&
        (!s.effective_from || new Date(s.effective_from) <= targetDate) &&
        (!s.effective_until || new Date(s.effective_until) > targetDate)
    );

    if (activeSub) {
      // Subsidy price_cents is now the hourly rate override
      const subsidyHourlyRateCents = activeSub.price_cents;
      // Use the minimum of subsidy rate and default/override rate
      hourlyRateCents = Math.min(hourlyRateCents, subsidyHourlyRateCents);
      // Use subsidy currency if provided, otherwise keep existing currency
      if (activeSub.currency) {
        currency = activeSub.currency.toLowerCase();
      }
    }
  }

  // Calculate total: hourly_rate * duration (rounded to nearest cent)
  return {
    amount_cents: Math.round(hourlyRateCents * durationHours),
    currency,
  };
}
