/** Badge variant for Stripe invoice status pills (matches Badge `variant` prop). */
export type InvoiceStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success';

/** Use for all "Paid" invoice status pills across apps. */
export const PAID_INVOICE_BADGE_VARIANT: InvoiceStatusBadgeVariant = 'success';

export type StripeInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible'
  | 'disputed';

/**
 * Maps a Stripe invoice status to the standard Badge variant.
 * Paid invoices use green (`success`), not the accent `default` variant.
 */
export function getInvoiceStatusBadgeVariant(
  status: StripeInvoiceStatus | string
): InvoiceStatusBadgeVariant {
  switch (status) {
    case 'paid':
      return PAID_INVOICE_BADGE_VARIANT;
    case 'draft':
      return 'outline';
    case 'open':
      return 'secondary';
    case 'void':
    case 'uncollectible':
    case 'disputed':
      return 'destructive';
    default:
      return 'secondary';
  }
}
