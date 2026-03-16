import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseInvoiceActionsProps {
  invoiceId: string;
  invoice?: Tables<'invoices'> | null;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
  /**
   * Optional callback for view on Stripe action
   */
  onViewOnStripe?: () => void;
  /**
   * Optional callback for download PDF action
   */
  onDownloadPdf?: () => void;
  /**
   * Optional callback for send invoice action
   */
  onSendInvoice?: () => void;
  /**
   * Optional callback for charge card action
   */
  onChargeCard?: () => void;
  /**
   * Optional callback for add credit note action
   */
  onAddCreditNote?: () => void;
  /**
   * Whether an action is currently loading
   */
  isLoadingAction?: boolean;
}

/**
 * Hook that centralizes invoice action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useInvoiceActions({
  invoiceId,
  invoice,
  onOpenInPage,
  onViewOnStripe,
  onDownloadPdf,
  onSendInvoice,
  onChargeCard,
  onAddCreditNote,
  isLoadingAction,
}: UseInvoiceActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/invoices/${invoiceId}`);
    }
  }, [invoiceId, router, onOpenInPage]);

  const handleViewOnStripe = useCallback(() => {
    if (onViewOnStripe) {
      onViewOnStripe();
    } else if (invoice?.hosted_invoice_url) {
      window.open(invoice.hosted_invoice_url, '_blank', 'noopener,noreferrer');
    }
  }, [invoice, onViewOnStripe]);

  const handleDownloadPdf = useCallback(() => {
    if (onDownloadPdf) {
      onDownloadPdf();
    } else if (invoice?.invoice_pdf) {
      window.open(invoice.invoice_pdf, '_blank', 'noopener,noreferrer');
    }
  }, [invoice, onDownloadPdf]);

  return {
    onOpenInPage: handleOpenInPage,
    onViewOnStripe: invoice?.hosted_invoice_url ? handleViewOnStripe : undefined,
    onDownloadPdf: invoice?.invoice_pdf ? handleDownloadPdf : undefined,
    onSendInvoice,
    onChargeCard,
    onAddCreditNote,
    isLoadingAction,
  };
}
