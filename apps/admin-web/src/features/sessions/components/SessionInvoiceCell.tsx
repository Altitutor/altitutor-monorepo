import { Button } from '@altitutor/ui';
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
  canSendNow: boolean;
  isSending: boolean;
  onSendNow: () => void;
};

export function SessionInvoiceCell({
  invoice,
  invoiceDetails,
  preview,
  canSendNow,
  isSending,
  onSendNow,
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
    return canSendNow ? (
      <Button
        variant="default"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={(event) => {
          event.stopPropagation();
          onSendNow();
        }}
        disabled={isSending}
      >
        {isSending ? 'Invoicing…' : 'Send invoice'}
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium">{formatCurrency(preview.amountCents, preview.currency)}</span>
      <span className="text-muted-foreground">
        {preview.action === 'bill' ? 'Bills' : 'Sends'} {preview.billingDate}
      </span>
      {canSendNow && (
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onSendNow();
          }}
          disabled={isSending}
        >
          {isSending ? 'Invoicing…' : 'Send invoice'}
        </Button>
      )}
    </div>
  );
}
