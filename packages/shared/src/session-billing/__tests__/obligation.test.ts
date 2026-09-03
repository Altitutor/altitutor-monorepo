import {
  deriveAbsenceBillingTreatment,
  getSessionBillingObligation,
} from '../obligation';

describe('getSessionBillingObligation', () => {
  it('does not charge a credited Planned absence', () => {
    const treatment = deriveAbsenceBillingTreatment({
      plannedAbsence: true,
      isCredited: true,
      isRescheduled: false,
    });

    expect(
      getSessionBillingObligation({
        amountCents: 10_000,
        isBillable: true,
        wasTrial: false,
        plannedAbsence: true,
        absenceBillingTreatment: treatment,
        actualAttendance: false,
      })
    ).toEqual({ amountCents: 0, reason: 'credited_absence' });
  });

  it.each([
    {
      name: 'does not charge a non-billable Session',
      input: { isBillable: false, wasTrial: false, plannedAbsence: false, absenceBillingTreatment: 'none' as const, actualAttendance: true },
      expected: { amountCents: 0, reason: 'not_billable' },
    },
    {
      name: 'does not charge a trial',
      input: { isBillable: true, wasTrial: true, plannedAbsence: false, absenceBillingTreatment: 'none' as const, actualAttendance: true },
      expected: { amountCents: 0, reason: 'trial' },
    },
    {
      name: 'charges a Session without a Planned absence',
      input: { isBillable: true, wasTrial: false, plannedAbsence: false, absenceBillingTreatment: 'none' as const, actualAttendance: false },
      expected: { amountCents: 10_000, reason: 'chargeable' },
    },
    {
      name: 'charges a charge-treated Planned absence',
      input: { isBillable: true, wasTrial: false, plannedAbsence: true, absenceBillingTreatment: 'charge' as const, actualAttendance: false },
      expected: { amountCents: 10_000, reason: 'chargeable' },
    },
    {
      name: 'does not charge a replacement-treated Planned absence',
      input: { isBillable: true, wasTrial: false, plannedAbsence: true, absenceBillingTreatment: 'replacement' as const, actualAttendance: false },
      expected: { amountCents: 0, reason: 'replacement_absence' },
    },
    {
      name: 'actual attendance overrides credit treatment',
      input: { isBillable: true, wasTrial: false, plannedAbsence: true, absenceBillingTreatment: 'credit' as const, actualAttendance: true },
      expected: { amountCents: 10_000, reason: 'chargeable' },
    },
    {
      name: 'actual attendance overrides replacement treatment',
      input: { isBillable: true, wasTrial: false, plannedAbsence: true, absenceBillingTreatment: 'replacement' as const, actualAttendance: true },
      expected: { amountCents: 10_000, reason: 'chargeable' },
    },
  ])('$name', ({ input, expected }) => {
    expect(getSessionBillingObligation({ amountCents: 10_000, ...input })).toEqual(expected);
  });
});

describe('deriveAbsenceBillingTreatment', () => {
  it('rejects contradictory credited and replacement flags', () => {
    expect(() =>
      deriveAbsenceBillingTreatment({
        plannedAbsence: true,
        isCredited: true,
        isRescheduled: true,
      })
    ).toThrow('cannot be both credited and rescheduled');
  });
});
