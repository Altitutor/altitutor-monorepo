import {
  applyCustomerBalanceToFutureCharge,
  buildFutureSessionCharges,
  selectRunnerInvoiceAssignmentIds,
} from '../future-invoices';

const pricing = [
  { billing_type: 'CLASS', hourly_rate_cents: 10_000, currency: 'AUD' },
];

function session(id: string, subjectId: string, startAt: string) {
  return {
    id,
    subjectId,
    billingType: 'CLASS',
    startAt,
    endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
  };
}

describe('buildFutureSessionCharges', () => {
  it('prices from the effective subsidy and accumulates earlier charges in session order', () => {
    const charges = buildFutureSessionCharges(
      [
        session('english-1', 'english', '2026-10-03T00:00:00.000Z'),
        session('math-2', 'math', '2026-10-02T00:00:00.000Z'),
        session('math-1', 'math', '2026-10-01T00:00:00.000Z'),
      ],
      {
        studentId: 'student-1',
        pricing,
        pricingOverrides: [],
        subsidies: [
          {
            student_id: 'student-1',
            subject_id: 'math',
            billing_type: 'CLASS',
            price_cents: 8_000,
            currency: 'AUD',
            effective_from: '2026-01-01T00:00:00.000Z',
            effective_until: null,
          },
        ],
      },
    );

    expect(charges.map(({ id, amountCents, priorChargeCents }) => ({
      id,
      amountCents,
      priorChargeCents,
    }))).toEqual([
      { id: 'math-1', amountCents: 8_000, priorChargeCents: 0 },
      { id: 'math-2', amountCents: 8_000, priorChargeCents: 8_000 },
      { id: 'english-1', amountCents: 10_000, priorChargeCents: 16_000 },
    ]);
  });
});

describe('applyCustomerBalanceToFutureCharge', () => {
  it('applies remaining credit after charges from earlier future sessions', () => {
    expect(
      applyCustomerBalanceToFutureCharge({
        fullAmountCents: 10_000,
        priorChargeCents: 8_000,
        invoiceCurrency: 'aud',
        customerBalanceCents: -12_000,
        customerBalanceCurrency: 'aud',
        isFirstInCurrency: false,
      }),
    ).toEqual({ creditAppliedCents: 4_000, balanceAddedCents: 0, payableCents: 6_000 });
  });

  it('adds a positive customer balance to the next invoice in that currency only', () => {
    expect(
      applyCustomerBalanceToFutureCharge({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: 'aud',
        customerBalanceCents: 2_000,
        customerBalanceCurrency: 'aud',
        isFirstInCurrency: true,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 2_000, payableCents: 12_000 });

    expect(
      applyCustomerBalanceToFutureCharge({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: 'aud',
        customerBalanceCents: 2_000,
        customerBalanceCurrency: 'aud',
        isFirstInCurrency: false,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 0, payableCents: 10_000 });
  });

  it('does not apply a customer balance in another currency', () => {
    expect(
      applyCustomerBalanceToFutureCharge({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: 'aud',
        customerBalanceCents: -10_000,
        customerBalanceCurrency: 'usd',
        isFirstInCurrency: true,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 0, payableCents: 10_000 });
  });
});

describe('selectRunnerInvoiceAssignmentIds', () => {
  it('keeps chargeable assignments that are not invoiced or adjustment-controlled', () => {
    expect(
      selectRunnerInvoiceAssignmentIds(
        ['chargeable', 'invoiced', 'adjustment', 'absent'],
        new Set(['chargeable', 'invoiced', 'adjustment']),
        new Set(['invoiced']),
        new Set(['adjustment']),
      ),
    ).toEqual(['chargeable']);
  });
});
