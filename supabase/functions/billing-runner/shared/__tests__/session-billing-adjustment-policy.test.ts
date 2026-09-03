import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import { buildRestorationBillingContext, buildSessionCreditNoteCommand } from '../session-billing-adjustment-policy.ts';

const baseCredit = {
  adjustmentId: 'adjustment-1',
  idempotencyKey: 'session-billing:ss-1:credit_note:line-1',
  stripeInvoiceId: 'in_1',
  stripeLines: [{ id: 'il_1', amountCents: 9000 }],
  sourceInvoiceItemId: 'line-1',
  sessionsStudentsId: 'ss-1',
  amountCents: 9000,
  reasonCategory: 'approved_absence',
  reasonNote: null,
} as const;

describe('session billing Stripe policy', () => {
  it('uses the durable adjustment key and credits only the source session line', () => {
    const command = buildSessionCreditNoteCommand({
      ...baseCredit,
      invoiceStatus: 'open',
    });

    expect(command.idempotencyKey).toBe(baseCredit.idempotencyKey);
    expect(command.params.lines).toEqual([{
      type: 'invoice_line_item',
      invoice_line_item: 'il_1',
      amount: 9000,
    }]);
    expect(command.params.metadata.billing_adjustment_id).toBe('adjustment-1');
    expect(command.params.email_type).toBe('none');
  });

  it('reduces an open invoice without creating a customer balance credit', () => {
    const command = buildSessionCreditNoteCommand({
      ...baseCredit,
      invoiceStatus: 'open',
    });
    expect('credit_amount' in command.params).toBe(false);
  });

  it('keeps the unused value on account for a paid invoice', () => {
    const command = buildSessionCreditNoteCommand({
      ...baseCredit,
      invoiceStatus: 'paid',
    });
    expect(command.params.credit_amount).toBe(9000);
  });

  it('credits an attributable legacy processing fee as a separate line', () => {
    const command = buildSessionCreditNoteCommand({
      ...baseCredit,
      amountCents: 9200,
      stripeLines: [
        { id: 'il_session', amountCents: 9000 },
        { id: 'il_fee', amountCents: 200 },
      ],
      invoiceStatus: 'paid',
    });

    expect(command.params.lines).toEqual([
      {
        type: 'invoice_line_item',
        invoice_line_item: 'il_session',
        amount: 9000,
      },
      { type: 'invoice_line_item', invoice_line_item: 'il_fee', amount: 200 },
    ]);
    expect(command.params.credit_amount).toBe(9200);
  });

  it('restores exactly the credited session amount and links the source credit note', () => {
    expect(buildRestorationBillingContext({
      adjustmentId: 'adjustment-2',
      creditNoteId: 'credit-note-1',
      amountCents: 9000,
      currency: 'AUD',
    })).toEqual({
      id: 'adjustment-2',
      kind: 'restoration_charge',
      restoresCreditNoteId: 'credit-note-1',
      amountCents: 9000,
      currency: 'AUD',
    });
  });
});
