export interface CreditNoteCommandInput {
  adjustmentId: string;
  idempotencyKey: string;
  stripeInvoiceId: string;
  stripeLines: ReadonlyArray<{ id: string; amountCents: number }>;
  sourceInvoiceItemId: string;
  sessionsStudentsId: string;
  amountCents: number;
  invoiceStatus: 'open' | 'paid';
  reasonCategory: string;
  reasonNote: string | null;
}

export function buildSessionCreditNoteCommand(input: CreditNoteCommandInput) {
  return {
    idempotencyKey: input.idempotencyKey,
    params: {
      invoice: input.stripeInvoiceId,
      lines: input.stripeLines.map((line) => ({
        type: 'invoice_line_item' as const,
        invoice_line_item: line.id,
        amount: line.amountCents,
      })),
      reason: 'order_change' as const,
      memo: input.reasonNote ?? 'Session absence credit',
      ...(input.invoiceStatus === 'paid' ? { credit_amount: input.amountCents } : {}),
      email_type: 'none' as const,
      metadata: {
        billing_adjustment_id: input.adjustmentId,
        source_invoice_item_id: input.sourceInvoiceItemId,
        sessions_students_id: input.sessionsStudentsId,
        reason_category: input.reasonCategory,
      },
    },
  };
}

export function buildRestorationBillingContext(input: {
  adjustmentId: string;
  creditNoteId: string;
  amountCents: number;
  currency: string;
}) {
  return {
    id: input.adjustmentId,
    kind: 'restoration_charge' as const,
    restoresCreditNoteId: input.creditNoteId,
    amountCents: input.amountCents,
    currency: input.currency,
  };
}
