import type Stripe from "npm:stripe@16.6.0";

/**
 * Stripe invoice.line lists may paginate; merge all pages into `invoice.lines.data`.
 */
export async function fillInvoiceLinesPagination(
  stripe: Stripe,
  inv: Stripe.Invoice,
): Promise<Stripe.Invoice> {
  const lines = inv.lines;
  if (!lines?.has_more) {
    return inv;
  }

  const all: Stripe.InvoiceLineItem[] = [...(lines.data ?? [])];
  let startingAfter = all[all.length - 1]?.id;
  while (startingAfter) {
    const page = await stripe.invoices.listLineItems(inv.id, {
      starting_after: startingAfter,
      limit: 100,
    });
    all.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return {
    ...inv,
    lines: {
      ...lines,
      data: all,
      has_more: false,
    },
  };
}

export async function retrieveInvoiceWithLines(
  stripe: Stripe,
  invoiceId: string,
  extraExpand: string[] = [],
): Promise<Stripe.Invoice> {
  const expand = [
    ...new Set(["lines.data", "customer", "subscription", ...extraExpand]),
  ];
  const inv = await stripe.invoices.retrieve(invoiceId, { expand });
  return fillInvoiceLinesPagination(stripe, inv);
}

/** Retrieve the invoice.paid context, including its payment intent. */
export function retrievePaidInvoiceWithLines(
  stripe: Stripe,
  invoiceId: string,
): Promise<Stripe.Invoice> {
  return retrieveInvoiceWithLines(stripe, invoiceId, ["payment_intent"]);
}
