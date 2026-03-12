import { format } from 'date-fns';
import { Badge } from '@altitutor/ui';

/**
 * Format invoice date
 */
export function formatInvoiceDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return format(date, 'EEEE, MMMM d, yyyy');
  } catch (e) {
    return dateString;
  }
}

/**
 * Get status badge for invoice
 */
export function getInvoiceStatusBadge(
  status: string,
  isRefunded?: boolean
) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  let label = status;

  switch (status) {
    case 'paid':
    case 'paid_refunded':
      variant = 'default';
      label = status === 'paid_refunded' || isRefunded ? 'Paid (Refunded)' : 'Paid';
      break;
    case 'draft':
      variant = 'outline';
      label = 'Draft';
      break;
    case 'open':
      variant = 'secondary';
      label = 'Open';
      break;
    case 'void':
    case 'uncollectible':
    case 'disputed':
      variant = 'destructive';
      label = status.charAt(0).toUpperCase() + status.slice(1);
      break;
    default:
      variant = 'outline';
  }

  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

/**
 * Format amount in cents to currency string
 */
export function formatInvoiceAmount(amountCents: number | null | undefined, currency: string = 'AUD'): string {
  const amount = amountCents || 0;
  return `$${(amount / 100).toFixed(2)} ${currency}`;
}

/**
 * Calculate line items subtotal
 */
export function calculateLineItemsSubtotal(invoiceItems: Array<{ amount_cents?: number | null }>): number {
  return invoiceItems.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
}
