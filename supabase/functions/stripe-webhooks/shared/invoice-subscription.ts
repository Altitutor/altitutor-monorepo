export type StripeObjectReference =
  | string
  | { id?: string | null }
  | null
  | undefined;

/**
 * The subscription reference moved from `invoice.subscription` to
 * `invoice.parent.subscription_details.subscription` in Stripe's 2025-03-31
 * Basil API release. Keep both shapes at the webhook boundary because endpoint
 * API versions can be upgraded independently from the Stripe SDK used here.
 */
export type InvoiceSubscriptionReference = {
  subscription?: StripeObjectReference;
  parent?: {
    type?: string | null;
    subscription_details?: {
      subscription?: StripeObjectReference;
    } | null;
  } | null;
};

function stripeObjectId(value: StripeObjectReference): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function getInvoiceSubscriptionId(
  invoice: InvoiceSubscriptionReference,
): string | null {
  const parentSubscription = invoice.parent?.type === "subscription_details"
    ? stripeObjectId(invoice.parent.subscription_details?.subscription)
    : null;

  return parentSubscription ?? stripeObjectId(invoice.subscription);
}
