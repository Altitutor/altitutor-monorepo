export interface SessionBillingLedgerSummary {
  obligationAmountCents: number;
  chargedAmountCents: number;
  creditedAmountCents: number;
  latestCreditNoteId: string | null;
}

export type RequiredSessionBillingAdjustment =
  | { kind: 'none' }
  | { kind: 'credit_note'; amountCents: number }
  | { kind: 'session_charge'; amountCents: number }
  | {
      kind: 'restoration_charge';
      amountCents: number;
      restoresCreditNoteId: string;
    };

export function getRequiredSessionBillingAdjustment(
  summary: SessionBillingLedgerSummary
): RequiredSessionBillingAdjustment {
  const amounts = [
    summary.obligationAmountCents,
    summary.chargedAmountCents,
    summary.creditedAmountCents,
  ];
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
    throw new Error('Session billing amounts must be non-negative integer cents');
  }

  const netChargedCents = summary.chargedAmountCents - summary.creditedAmountCents;
  const differenceCents = summary.obligationAmountCents - netChargedCents;

  if (differenceCents === 0) return { kind: 'none' };
  if (differenceCents < 0) {
    return { kind: 'credit_note', amountCents: Math.abs(differenceCents) };
  }
  if (summary.creditedAmountCents > 0 && summary.latestCreditNoteId) {
    return {
      kind: 'restoration_charge',
      amountCents: differenceCents,
      restoresCreditNoteId: summary.latestCreditNoteId,
    };
  }
  return { kind: 'session_charge', amountCents: differenceCents };
}
