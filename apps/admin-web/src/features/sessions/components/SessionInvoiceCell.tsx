import {
  getInvoiceStatusBadge,
  type InvoiceStatusPayload,
} from '@/features/billing/utils/invoiceFormatters';
import { formatCurrency } from '@/shared/utils/pricing';
import { openAdminInvoiceModal } from '../utils/openAdminInvoiceModal';
import type {
  SessionInvoiceDetails,
  SessionInvoicePreview,
} from '../hooks/useStudentSessionBillingDetails';

type SessionInvoiceCellProps = {
  invoice: InvoiceStatusPayload | null;
  invoiceDetails?: SessionInvoiceDetails;
  preview?: SessionInvoicePreview;
};

export function SessionInvoiceCell({
  invoice,
  invoiceDetails,
  preview,
}: SessionInvoiceCellProps) {
  if (invoice) {
    const invoiceId = invoice.invoice_id;
    const statusBadges = getInvoiceStatusBadge(invoice);

    return (
      <button
        type="button"
        className="inline-flex flex-wrap items-center gap-1 text-left text-xs text-accent-foreground hover:underline disabled:cursor-default disabled:no-underline"
        disabled={!invoiceId}
        onClick={(event) => {
          event.stopPropagation();
          if (invoiceId) openAdminInvoiceModal(invoiceId);
        }}
      >
        <span className="font-medium">
          #{invoiceDetails?.invoiceNumber || invoiceId?.slice(0, 8) || 'Invoice'}
        </span>
        {invoiceDetails && (
          <span>{formatCurrency(invoiceDetails.amountCents, invoiceDetails.currency)}</span>
        )}
        {statusBadges}
      </button>
    );
  }

  if (!preview) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const balanceAdjusted = preview.creditAppliedCents > 0 || preview.balanceAddedCents > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex flex-col">
        {balanceAdjusted && (
          <span className="text-muted-foreground line-through">
            {formatCurrency(preview.fullAmountCents, preview.currency)}
          </span>
        )}
        <span className="font-medium">{formatCurrency(preview.amountCents, preview.currency)}</span>
        {balanceAdjusted && (
          <span className="text-muted-foreground">
            {preview.balanceAddedCents > 0 ? 'Balance added' : 'Credit applied'}
          </span>
        )}
      </span>
      <span className="text-muted-foreground">
        {preview.action === 'bill' ? 'Bills' : 'Sends'} {preview.billingDate}
      </span>

    </div>
  );
}
