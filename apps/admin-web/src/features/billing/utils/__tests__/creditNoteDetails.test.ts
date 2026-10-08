import {
  stripeCreditNoteDetails,
  storedCreditNoteDetails,
} from "../creditNoteDetails";
import type { CreditNoteRow } from "../../types";

const note = {
  id: "cn_test",
  status: "issued",
  amount: 10000,
  currency: "aud",
  created: 1791259200,
  reason: "order_change",
  memo: "Absence",
  metadata: { internal_note: "Approved" },
  pre_payment_amount: 4000,
  post_payment_amount: 6000,
  refunds: [
    {
      amount_refunded: 1000,
      refund: "re_1",
      payment_record_refund: null,
      type: "refund",
    },
    {
      amount_refunded: 1000,
      refund: "re_2",
      payment_record_refund: null,
      type: "refund",
    },
  ],
  customer_balance_transaction: "cbt_test",
  out_of_band_amount: 1000,
} satisfies Parameters<typeof stripeCreditNoteDetails>[0];

it("preserves mixed pre/post payment outcomes without allocating the whole note to balance credit", () => {
  expect(stripeCreditNoteDetails(note)).toMatchObject({
    amount_cents: 10000,
    pre_payment_amount_cents: 4000,
    refund_amount_cents: 2000,
    credit_amount_cents: 3000,
    out_of_band_amount_cents: 1000,
    memo: "Absence",
    internal_note: "Approved",
    outcome_verified: true,
  });
});

it("preserves a before-payment reduction even if the invoice is now paid", () => {
  expect(
    stripeCreditNoteDetails({
      ...note,
      pre_payment_amount: 10000,
      post_payment_amount: 0,
      refunds: [],
      customer_balance_transaction: null,
      out_of_band_amount: null,
    }),
  ).toMatchObject({
    pre_payment_amount_cents: 10000,
    refund_amount_cents: 0,
    credit_amount_cents: 0,
  });
});

it("does not guess the outcome when older records lack the Stripe payment split", () => {
  expect(
    storedCreditNoteDetails({
      id: "local",
      amount_cents: 10000,
      invoice_id: "invoice",
      stripe_credit_note_id: "cn_test",
      status: "issued",
      currency: "aud",
      created_at: "2026-10-06",
      updated_at: "2026-10-06",
      reason: null,
      refund_amount_cents: null,
      out_of_band_amount_cents: null,
      billing_adjustment_id: null,
      source_invoice_item_id: null,
      voided_at: null,
      metadata: { memo: "Memo", internal_note: "Private" },
      credit_amount_cents: 10000,
    } satisfies CreditNoteRow),
  ).toMatchObject({
    memo: "Memo",
    internal_note: "Private",
    pre_payment_amount_cents: null,
    outcome_verified: false,
  });
});
