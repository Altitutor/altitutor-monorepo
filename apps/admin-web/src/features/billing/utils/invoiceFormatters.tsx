import { format } from 'date-fns';
import { Badge } from '@altitutor/ui';
import type { InvoiceRow } from '../types';

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

function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

type InvoiceLike = Pick<
  InvoiceRow,
  'status' | 'paid_at' | 'refunded_at' | 'has_credit_notes' | 'is_refunded'
> & {
  credit_notes?: { credit_amount_cents: number | null; created_at: string }[] | null;
};

/**
 * Get status badges for an invoice, including dated Paid / Refunded / Credited pills.
 * Supports multiple statuses (e.g. Paid and Refunded) rendered as separate badges.
 */
export function getInvoiceStatusBadge(
  invoiceOrStatus: InvoiceLike | string,
  isRefundedLegacy?: boolean
) {
  // Backwards compatibility: allow calling with (status, isRefunded)
  if (typeof invoiceOrStatus === 'string') {
    const status = invoiceOrStatus;
    const isRefunded = status === 'paid_refunded' || !!isRefundedLegacy;
    const refundedLabel = isRefunded ? 'Paid (Refunded)' : 'Paid';

    switch (status) {
      case 'paid':
        return (
          <Badge variant={isRefunded ? 'destructive' : 'default'} className="text-xs">
            {refundedLabel}
          </Badge>
        );
      case 'paid_refunded':
        return (
          <Badge variant="destructive" className="text-xs">
            Paid (Refunded)
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="text-xs">
            Draft
          </Badge>
        );
      case 'open':
        return (
          <Badge variant="secondary" className="text-xs">
            Open
          </Badge>
        );
      case 'void':
      case 'uncollectible':
      case 'disputed':
        return (
          <Badge variant="destructive" className="text-xs">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  }

  const invoice = invoiceOrStatus;
  const pills: { key: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = [];

  // Draft/open/terminal statuses behave as before (single pill, no dates)
  if (invoice.status === 'draft') {
    pills.push({ key: 'draft', label: 'Draft', variant: 'outline' });
  } else if (invoice.status === 'open') {
    pills.push({ key: 'open', label: 'Open', variant: 'secondary' });
  } else if (invoice.status === 'void' || invoice.status === 'uncollectible' || invoice.status === 'disputed') {
    pills.push({
      key: invoice.status,
      label: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
      variant: 'destructive',
    });
  } else {
    // Paid pill
    if (invoice.status === 'paid' || invoice.status === 'paid_refunded' || invoice.paid_at) {
      const paidDate = formatShortDate(invoice.paid_at);
      const paidLabel = paidDate ? `Paid ${paidDate}` : 'Paid';
      pills.push({ key: 'paid', label: paidLabel, variant: 'default' });
    }

    // Refunded pill
    const isRefunded =
      invoice.status === 'paid_refunded' ||
      !!invoice.refunded_at ||
      !!invoice.has_credit_notes ||
      !!invoice.is_refunded;
    if (isRefunded) {
      const refundDate = formatShortDate(invoice.refunded_at);
      const refundedLabel = refundDate ? `Refunded ${refundDate}` : 'Refunded';
      pills.push({ key: 'refunded', label: refundedLabel, variant: 'destructive' });
    }

    // Credited pill – any non-void credit note with credit_amount_cents > 0
    const creditNotes = invoice.credit_notes || [];
    const creditNoteForBalance = creditNotes.find(
      (cn) => (cn.credit_amount_cents ?? 0) > 0
    );
    if (creditNoteForBalance) {
      const creditedDate = formatShortDate(creditNoteForBalance.created_at);
      const creditedLabel = creditedDate ? `Credited ${creditedDate}` : 'Credited';
      pills.push({ key: 'credited', label: creditedLabel, variant: 'outline' });
    }
  }

  if (pills.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((pill) => (
        <Badge key={pill.key} variant={pill.variant} className="text-xs">
          {pill.label}
        </Badge>
      ))}
    </div>
  );
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
