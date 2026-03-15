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

function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

/** Invoice-like data for status badge display. Supports both full invoice and RPC payload. */
export type InvoiceStatusPayload = {
  status: string;
  paid_at?: string | null;
  refunded_at?: string | null;
  refunded_via_cn_at?: string | null;
  credited_at?: string | null;
  credit_notes?: Array<{
    refund_amount_cents?: number | null;
    credit_amount_cents?: number | null;
    created_at: string;
  }> | null;
};

/**
 * Get status badges for an invoice. Centralized display everywhere.
 *
 * Behaviour:
 * - draft/open/void/uncollectible/disputed: single pill
 * - paid: if paid_at present → "Paid ({date})"
 * - refunded: if credit note with refund_amount_cents > 0 OR refunded_at → "Refunded ({date})"
 * - credited: if credit note with credit_amount_cents > 0 → "Credited ({date})"
 * - Shows as many pills as criteria are met
 */
export function getInvoiceStatusBadge(invoice: InvoiceStatusPayload | null | undefined): React.ReactNode {
  if (!invoice) return null;

  const pills: { key: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = [];

  // Simple statuses: single pill, no dates
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
    // Paid pill: if paid_at present
    const paidAt = invoice.paid_at;
    if (invoice.status === 'paid' || paidAt) {
      const paidLabel = paidAt ? `Paid (${formatShortDate(paidAt)})` : 'Paid';
      pills.push({ key: 'paid', label: paidLabel, variant: 'default' });
    }

    // Refunded pill: credit note with refund_amount_cents > 0 OR refunded_at
    const hasRefundCn = (invoice.credit_notes ?? []).some((cn) => (cn.refund_amount_cents ?? 0) > 0);
    const refundedAt = invoice.refunded_at ?? invoice.refunded_via_cn_at ?? null;
    const isRefunded = !!refundedAt || hasRefundCn;
    if (isRefunded) {
      const dateForRefund =
        refundedAt ??
        (invoice.credit_notes ?? []).find((cn) => (cn.refund_amount_cents ?? 0) > 0)?.created_at;
      const refundedLabel = dateForRefund ? `Refunded (${formatShortDate(dateForRefund)})` : 'Refunded';
      pills.push({ key: 'refunded', label: refundedLabel, variant: 'destructive' });
    }

    // Credited pill: credit note with credit_amount_cents > 0
    const hasCreditCn = (invoice.credit_notes ?? []).some((cn) => (cn.credit_amount_cents ?? 0) > 0);
    const creditedAt = invoice.credited_at ?? null;
    const isCredited = !!creditedAt || hasCreditCn;
    if (isCredited) {
      const dateForCredit =
        creditedAt ??
        (invoice.credit_notes ?? []).find((cn) => (cn.credit_amount_cents ?? 0) > 0)?.created_at;
      const creditedLabel = dateForCredit ? `Credited (${formatShortDate(dateForCredit)})` : 'Credited';
      pills.push({ key: 'credited', label: creditedLabel, variant: 'outline' });
    }
  }

  if (pills.length === 0) return null;

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
 * Build InvoiceStatusPayload from invoice row (for list/detail views with refunded_via_cn_at, credited_at).
 */
export function toInvoiceStatusPayload(invoice: {
  status: string;
  paid_at?: string | null;
  refunded_at?: string | null;
  refunded_via_cn_at?: string | null;
  credited_at?: string | null;
  credit_notes?: InvoiceStatusPayload['credit_notes'];
} | null): InvoiceStatusPayload | null {
  if (!invoice) return null;
  return {
    status: invoice.status,
    paid_at: invoice.paid_at ?? null,
    refunded_at: invoice.refunded_at ?? null,
    refunded_via_cn_at: invoice.refunded_via_cn_at ?? null,
    credited_at: invoice.credited_at ?? null,
    credit_notes: invoice.credit_notes ?? null,
  };
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
