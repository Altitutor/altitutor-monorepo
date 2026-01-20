'use client';

import { useRouter } from 'next/navigation';
import { Button, Separator, Badge } from '@altitutor/ui';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { cn } from '@/shared/utils';
import {
  useInvoiceData,
  useInvoiceModals,
  formatInvoiceDate,
  getInvoiceStatusBadge,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
} from '@/features/billing';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  // Business logic hooks
  const invoiceData = useInvoiceData({
    invoiceId: id,
    enabled: !!id,
  });

  const modals = useInvoiceModals();

  const { invoice, invoiceItems, isLoading } = invoiceData;

  // Computed values
  const totalAmount = invoice?.amount_due_cents || 0;
  const totalAmountFormatted = `$${(totalAmount / 100).toFixed(2)}`;
  const lineItemsSubtotal = calculateLineItemsSubtotal(invoiceItems);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/invoices')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/invoices')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Invoice Details</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Invoice #{invoice.stripe_invoice_number || invoice.id.slice(0, 8)}
          </p>
        </div>
        <ActionsMenu
          type="invoice"
          onOpenInPage={() => {
            router.push(`/invoices/${id}`);
          }}
          onViewOnStripe={invoice.hosted_invoice_url ? () => {
            window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
          } : undefined}
          onDownloadPdf={invoice.invoice_pdf ? () => {
            window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
          } : undefined}
        />
      </div>

      <div className="space-y-6">
        {/* Invoice Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Invoice Information</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="text-sm font-medium text-muted-foreground">Student:</div>
            <div className="text-sm">
              {invoice.student ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm justify-start"
                  onClick={() => modals.openStudentModal(invoice.student!.id)}
                >
                  {invoice.student.first_name} {invoice.student.last_name}
                </Button>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            
            <div className="text-sm font-medium text-muted-foreground">Invoice Date:</div>
            <div className="text-sm">{formatInvoiceDate(invoice.invoice_date)}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Status:</div>
            <div className="text-sm">{getInvoiceStatusBadge(invoice.status)}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Amount Due:</div>
            <div className="text-sm">
              {formatInvoiceAmount(invoice.amount_due_cents, invoice.currency || 'AUD')}
            </div>
            
            <div className="text-sm font-medium text-muted-foreground">Amount Paid:</div>
            <div className="text-sm">
              {formatInvoiceAmount(invoice.amount_paid_cents, invoice.currency || 'AUD')}
            </div>
          </div>
        </div>

        <Separator />

        {/* Invoice Line Items */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Line Items</h3>
          {invoiceItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No line items</div>
          ) : (
            <div className="space-y-3">
              {invoiceItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start justify-between p-3 rounded-md border",
                    item.session_id && "cursor-pointer hover:bg-muted/50 transition-colors"
                  )}
                  onClick={() => {
                    if (item.session_id) {
                      modals.openSessionModal(item.session_id);
                    }
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", item.is_subsidy && "text-muted-foreground line-through")}>
                        {item.description || 'Invoice item'}
                      </span>
                      {item.is_subsidy && (
                        <Badge variant="outline" className="text-xs">Subsidy</Badge>
                      )}
                    </div>
                    {item.session_id && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Click to view session
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium ml-4">
                    ${((item.amount_cents || 0) / 100).toFixed(2)}
                  </div>
                </div>
              ))}
              
              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t font-semibold">
                <div className="text-sm">Total:</div>
                <div className="text-sm">{totalAmountFormatted}</div>
              </div>
              
              {/* Show warning if line items don't match total */}
              {Math.abs(totalAmount - lineItemsSubtotal) > 1 && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  Note: Line items total (${(lineItemsSubtotal / 100).toFixed(2)}) differs from invoice total. 
                  This may indicate missing fee items or other charges not yet synced from Stripe.
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div>
        </div>
      </div>

      {/* Student Modal */}
      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.studentModalOpen}
          studentId={modals.selectedStudentId}
          onClose={modals.closeStudentModal}
          onStudentUpdated={() => {}}
        />
      )}

      {/* Session Modal */}
      {modals.selectedSessionId && (
        <SessionModal
          isOpen={modals.sessionModalOpen}
          sessionId={modals.selectedSessionId}
          onClose={modals.closeSessionModal}
        />
      )}
    </div>
  );
}
