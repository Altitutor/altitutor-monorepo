import { getRequiredSessionBillingAdjustment } from '../adjustment';

describe('getRequiredSessionBillingAdjustment', () => {
  it('creates a Restoration charge when actual attendance restores a fully credited obligation', () => {
    expect(
      getRequiredSessionBillingAdjustment({
        obligationAmountCents: 10_000,
        chargedAmountCents: 10_000,
        creditedAmountCents: 10_000,
        latestCreditNoteId: 'credit-note-1',
      })
    ).toEqual({
      kind: 'restoration_charge',
      amountCents: 10_000,
      restoresCreditNoteId: 'credit-note-1',
    });
  });

  it.each([
    {
      name: 'does nothing when the net charge matches the obligation',
      input: { obligationAmountCents: 10_000, chargedAmountCents: 10_000, creditedAmountCents: 0, latestCreditNoteId: null },
      expected: { kind: 'none' },
    },
    {
      name: 'credits the excess net charge',
      input: { obligationAmountCents: 0, chargedAmountCents: 10_000, creditedAmountCents: 0, latestCreditNoteId: null },
      expected: { kind: 'credit_note', amountCents: 10_000 },
    },
    {
      name: 'creates an ordinary charge for a newly discovered obligation',
      input: { obligationAmountCents: 10_000, chargedAmountCents: 0, creditedAmountCents: 0, latestCreditNoteId: null },
      expected: { kind: 'session_charge', amountCents: 10_000 },
    },
    {
      name: 'does nothing after a Restoration charge returns the net charge to the obligation',
      input: { obligationAmountCents: 10_000, chargedAmountCents: 20_000, creditedAmountCents: 10_000, latestCreditNoteId: 'credit-note-1' },
      expected: { kind: 'none' },
    },
    {
      name: 'credits a Restoration charge after attendance is corrected back to absent',
      input: { obligationAmountCents: 0, chargedAmountCents: 20_000, creditedAmountCents: 10_000, latestCreditNoteId: 'credit-note-1' },
      expected: { kind: 'credit_note', amountCents: 10_000 },
    },
    {
      name: 'restores the latest credit after attendance is corrected to attended again',
      input: { obligationAmountCents: 10_000, chargedAmountCents: 20_000, creditedAmountCents: 20_000, latestCreditNoteId: 'credit-note-2' },
      expected: { kind: 'restoration_charge', amountCents: 10_000, restoresCreditNoteId: 'credit-note-2' },
    },
  ])('$name', ({ input, expected }) => {
    expect(getRequiredSessionBillingAdjustment(input)).toEqual(expected);
  });

  it('rejects negative ledger amounts', () => {
    expect(() =>
      getRequiredSessionBillingAdjustment({
        obligationAmountCents: 10_000,
        chargedAmountCents: -1,
        creditedAmountCents: 0,
        latestCreditNoteId: null,
      })
    ).toThrow('non-negative integer cents');
  });
});
