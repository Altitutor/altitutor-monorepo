import type Stripe from "npm:stripe@16.6.0";

export type InvoiceLifecycleUpdate = {
  status: Stripe.Invoice.Status;
  stripe_invoice_number: string | null;
  subtotal_cents: number | null;
  total_cents: number | null;
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_paid_from_balance_cents: number | null;
  currency: string;
  collection_method: Stripe.Invoice.CollectionMethod;
  auto_advance: boolean | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  finalized_at: string | null;
  paid_at: string | null;
};

export type InvoiceLifecyclePersistenceResult = {
  matched: boolean;
};

type SynchronizePersistedInvoiceOptions = {
  stripeInvoiceId: string;
  retrieveInvoice: (invoiceId: string) => Promise<Stripe.Invoice>;
  persistInvoice: (
    invoiceId: string,
    update: InvoiceLifecycleUpdate,
    allowedCurrentStatuses: Stripe.Invoice.Status[],
  ) => Promise<InvoiceLifecyclePersistenceResult>;
};

function allowedCurrentStatusesFor(
  targetStatus: Stripe.Invoice.Status,
): Stripe.Invoice.Status[] {
  switch (targetStatus) {
    case "draft":
      return ["draft"];
    case "open":
      return ["draft", "open"];
    case "paid":
      return ["draft", "open", "paid"];
    case "uncollectible":
      return ["draft", "open", "uncollectible"];
    case "void":
      return ["draft", "open", "uncollectible", "void"];
  }
}

function stripeTimestampToIso(timestamp: number | null): string | null {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

export function buildInvoiceLifecycleUpdate(
  invoice: Stripe.Invoice,
): InvoiceLifecycleUpdate {
  const totalCents = invoice.total ?? null;
  const amountDueCents = invoice.amount_due ?? 0;

  return {
    status: invoice.status ?? "draft",
    stripe_invoice_number: invoice.number,
    subtotal_cents: invoice.subtotal ?? null,
    total_cents: totalCents,
    amount_due_cents: amountDueCents,
    amount_paid_cents: invoice.amount_paid ?? 0,
    amount_paid_from_balance_cents: totalCents === null
      ? null
      : Math.max(0, totalCents - amountDueCents),
    currency: invoice.currency,
    collection_method: invoice.collection_method,
    auto_advance: invoice.auto_advance ?? null,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    finalized_at: stripeTimestampToIso(
      invoice.status_transitions.finalized_at,
    ),
    paid_at: stripeTimestampToIso(invoice.status_transitions.paid_at),
  };
}

/**
 * Synchronize from a fresh Stripe read, never from a possibly stale webhook snapshot.
 */
export async function synchronizePersistedInvoice(
  options: SynchronizePersistedInvoiceOptions,
): Promise<{
  invoice: Stripe.Invoice;
  persistence: InvoiceLifecyclePersistenceResult;
}> {
  const invoice = await options.retrieveInvoice(options.stripeInvoiceId);
  const persistence = await options.persistInvoice(
    invoice.id,
    buildInvoiceLifecycleUpdate(invoice),
    allowedCurrentStatusesFor(invoice.status ?? "draft"),
  );

  if (
    !persistence.matched &&
    invoice.metadata?.type === "session_invoice" &&
    invoice.status !== "void" &&
    invoice.status !== "uncollectible"
  ) {
    throw new Error(`Session invoice ${invoice.id} is not persisted yet`);
  }

  return { invoice, persistence };
}
