import type Stripe from "stripe";
import type { CreditNoteRow } from "../types";

export type CreditNoteDetails = Pick<
  CreditNoteRow,
  | "id"
  | "stripe_credit_note_id"
  | "status"
  | "amount_cents"
  | "currency"
  | "created_at"
  | "reason"
  | "refund_amount_cents"
  | "credit_amount_cents"
  | "out_of_band_amount_cents"
> & {
  memo: string | null;
  internal_note: string | null;
  pre_payment_amount_cents: number | null;
  outcome_verified: boolean;
};

function metadataText(
  metadata: CreditNoteRow["metadata"],
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Historical rows lack Stripe's pre/post-payment split; don't guess from today's invoice status. */
export function storedCreditNoteDetails(
  note: CreditNoteRow,
): CreditNoteDetails {
  return {
    ...note,
    memo: metadataText(note.metadata, "memo"),
    internal_note: metadataText(note.metadata, "internal_note"),
    pre_payment_amount_cents: null,
    outcome_verified: false,
  };
}

export function stripeCreditNoteDetails(
  note: Pick<
    Stripe.CreditNote,
    | "id"
    | "status"
    | "amount"
    | "currency"
    | "created"
    | "reason"
    | "memo"
    | "metadata"
    | "pre_payment_amount"
    | "post_payment_amount"
    | "refunds"
    | "customer_balance_transaction"
    | "out_of_band_amount"
  >,
): CreditNoteDetails {
  const refundAmount = note.refunds.reduce(
    (sum, refund) => sum + refund.amount_refunded,
    0,
  );
  const externalAmount = note.out_of_band_amount ?? 0;
  return {
    id: note.id,
    stripe_credit_note_id: note.id,
    status: note.status,
    amount_cents: note.amount,
    currency: note.currency,
    created_at: new Date(note.created * 1000).toISOString(),
    reason: note.reason,
    memo: note.memo?.trim() || note.metadata?.memo?.trim() || null,
    internal_note: note.metadata?.internal_note?.trim() || null,
    pre_payment_amount_cents: note.pre_payment_amount,
    refund_amount_cents: refundAmount,
    credit_amount_cents: note.customer_balance_transaction
      ? Math.max(0, note.post_payment_amount - refundAmount - externalAmount)
      : 0,
    out_of_band_amount_cents: externalAmount,
    outcome_verified: true,
  };
}

export function formatCreditNoteReason(reason: string): string {
  const labels: Record<string, string> = {
    duplicate: "Duplicate charge",
    fraudulent: "Fraudulent activity",
    order_change: "Order change",
    product_unsatisfactory: "Unsatisfactory service",
    other: "Other",
  };
  return labels[reason] ?? reason;
}
