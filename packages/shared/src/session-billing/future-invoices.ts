export interface SessionHourlyRate {
  billing_type: string;
  hourly_rate_cents: number;
  currency: string;
}

export interface SessionHourlyRateOverride extends SessionHourlyRate {
  subject_id: string;
  effective_from: string;
  effective_until: string | null;
}

export interface SessionSubsidy {
  student_id: string;
  subject_id: string;
  billing_type: string;
  price_cents: number;
  currency: string | null;
  effective_from: string | null;
  effective_until: string | null;
}

export interface FutureSessionForPricing {
  id: string;
  subjectId: string;
  billingType: string;
  startAt: string;
  endAt: string;
}

export interface FutureSessionPricingContext {
  studentId: string;
  pricing: SessionHourlyRate[];
  pricingOverrides: SessionHourlyRateOverride[];
  subsidies: SessionSubsidy[];
}

export type PricedFutureSession<T extends FutureSessionForPricing = FutureSessionForPricing> =
  T & {
    amountCents: number;
    priorChargeCents: number;
    currency: string;
    isFirstInCurrency: boolean;
  };

function isEffectiveAt(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  at: Date,
): boolean {
  return (
    (!effectiveFrom || new Date(effectiveFrom) <= at) &&
    (!effectiveUntil || new Date(effectiveUntil) > at)
  );
}

export function calculateFutureSessionAmount(
  session: FutureSessionForPricing,
  { studentId, pricing, pricingOverrides, subsidies }: FutureSessionPricingContext,
): { amountCents: number; currency: string } {
  const sessionDate = new Date(session.startAt);
  const defaultPrice = pricing.find(
    (price) => price.billing_type === session.billingType,
  );
  const override = pricingOverrides.find(
    (price) =>
      price.subject_id === session.subjectId &&
      price.billing_type === session.billingType &&
      isEffectiveAt(price.effective_from, price.effective_until, sessionDate),
  );

  let hourlyRateCents =
    override?.hourly_rate_cents ?? defaultPrice?.hourly_rate_cents ?? 0;
  let currency = (
    override?.currency ??
    defaultPrice?.currency ??
    'aud'
  ).toLowerCase();

  const subsidy = subsidies.find(
    (row) =>
      row.student_id === studentId &&
      row.subject_id === session.subjectId &&
      row.billing_type === session.billingType &&
      isEffectiveAt(row.effective_from, row.effective_until, sessionDate),
  );
  if (subsidy) {
    hourlyRateCents = Math.min(hourlyRateCents, subsidy.price_cents);
    if (subsidy.currency) {
      currency = subsidy.currency.toLowerCase();
    }
  }

  const durationHours =
    (new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) /
    (60 * 60 * 1000);

  return {
    amountCents: Math.round(hourlyRateCents * durationHours),
    currency,
  };
}

/**
 * Prices each session and records how much has already been allocated to
 * earlier sessions in the same currency. Callers use `priorChargeCents` to
 * apply one customer credit balance across invoices in session order.
 */
export function buildFutureSessionCharges<T extends FutureSessionForPricing>(
  sessions: T[],
  pricingContext: FutureSessionPricingContext,
): PricedFutureSession<T>[] {
  const sorted = [...sessions].sort((left, right) => {
    const timeDifference =
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });

  const cumulativeChargesByCurrency = new Map<string, number>();
  const seenCurrencies = new Set<string>();

  return sorted.map((session) => {
    const { amountCents, currency } = calculateFutureSessionAmount(
      session,
      pricingContext,
    );
    const priorChargeCents = cumulativeChargesByCurrency.get(currency) ?? 0;
    const isFirstInCurrency = !seenCurrencies.has(currency);
    cumulativeChargesByCurrency.set(currency, priorChargeCents + amountCents);
    seenCurrencies.add(currency);
    return {
      ...session,
      amountCents,
      priorChargeCents,
      currency,
      isFirstInCurrency,
    };
  });
}

/**
 * Assignments the billing runner will invoice: chargeable, not already
 * invoiced, and not controlled by an open session billing adjustment.
 */
export function selectRunnerInvoiceAssignmentIds(
  assignmentIds: readonly string[],
  chargeableIds: ReadonlySet<string>,
  invoicedIds: ReadonlySet<string>,
  adjustmentControlledIds: ReadonlySet<string>,
): string[] {
  return assignmentIds.filter(
    (id) =>
      chargeableIds.has(id) &&
      !invoicedIds.has(id) &&
      !adjustmentControlledIds.has(id),
  );
}

/**
 * Stripe applies the customer balance when the next matching-currency invoice
 * is finalized. A negative balance is credit and reduces invoices in order
 * until it is used up. A positive balance is added in full to that next
 * invoice only.
 */
export function applyCustomerBalanceToFutureCharge({
  fullAmountCents,
  priorChargeCents,
  invoiceCurrency,
  customerBalanceCents,
  customerBalanceCurrency,
  isFirstInCurrency,
}: {
  fullAmountCents: number;
  priorChargeCents: number;
  invoiceCurrency: string;
  customerBalanceCents: number;
  customerBalanceCurrency: string;
  isFirstInCurrency: boolean;
}): { creditAppliedCents: number; balanceAddedCents: number; payableCents: number } {
  if (invoiceCurrency.toLowerCase() !== customerBalanceCurrency.toLowerCase()) {
    return { creditAppliedCents: 0, balanceAddedCents: 0, payableCents: fullAmountCents };
  }

  if (customerBalanceCents > 0) {
    const balanceAddedCents = isFirstInCurrency ? customerBalanceCents : 0;
    return {
      creditAppliedCents: 0,
      balanceAddedCents,
      payableCents: fullAmountCents + balanceAddedCents,
    };
  }

  const availableCreditCents = Math.max(0, -customerBalanceCents);
  const remainingCreditCents = Math.max(
    0,
    availableCreditCents - priorChargeCents,
  );
  const creditAppliedCents = Math.min(fullAmountCents, remainingCreditCents);

  return {
    creditAppliedCents,
    balanceAddedCents: 0,
    payableCents: fullAmountCents - creditAppliedCents,
  };
}
