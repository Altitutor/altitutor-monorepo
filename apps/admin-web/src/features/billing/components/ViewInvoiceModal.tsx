'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Separator, Badge, Button } from '@altitutor/ui';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getInvoiceStatusBadge } from '../utils/invoiceFormatters';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { cn } from '@/shared/utils';
import {
  useInvoiceData,
  useInvoiceModals,
  formatInvoiceDate,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
} from '../index';

type ViewInvoiceModalProps = {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
};

export function ViewInvoiceModal({ isOpen, invoiceId, onClose }: ViewInvoiceModalProps) {
  const router = useRouter();

  // Business logic hooks
  const invoiceData = useInvoiceData({
    invoiceId: invoiceId,
    enabled: isOpen && !!invoiceId,
  });

  const modals = useInvoiceModals();

  const { invoice, invoiceItems, isLoading } = invoiceData;

  // Computed values
  const totalAmount = invoice?.amount_due_cents || 0;
  const totalAmountFormatted = `$${(totalAmount / 100).toFixed(2)}`;
  const lineItemsSubtotal = calculateLineItemsSubtotal(invoiceItems);

  // Always render the Sheet to allow exit animation
  if (isLoading || !invoice) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] md:max-w-none overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4">
            <SheetTitle>{isLoading ? 'Loading...' : ''}</SheetTitle>
          </SheetHeader>
          {isLoading && (
            <div className="py-6 text-center text-muted-foreground px-6">Loading invoice details...</div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onClose}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <SheetTitle>Invoice Details</SheetTitle>
                    <SheetDescription className="text-lg font-medium">
                      Invoice #{invoice.stripe_invoice_number || invoice.id.slice(0, 8)}
                    </SheetDescription>
                  </div>
                </div>
                {invoiceId && (
                  <ActionsMenu
                    type="invoice"
                    onOpenInPage={() => {
                      router.push(`/invoices/${invoiceId}`);
                      onClose();
                    }}
                    onViewOnStripe={invoice.hosted_invoice_url ? () => {
                      window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
                    } : undefined}
                    onDownloadPdf={invoice.invoice_pdf ? () => {
                      window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
                    } : undefined}
                  />
                )}
              </div>
            </SheetHeader>
            
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
                  <div className="text-sm">
                    {getInvoiceStatusBadge(invoice.status)}
                  </div>
                  
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
                    
                    {/* Show warning if line items don't match total (indicates missing items or data inconsistency) */}
                    {Math.abs(totalAmount - lineItemsSubtotal) > 1 && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                        Note: Line items total (${(lineItemsSubtotal / 100).toFixed(2)}) differs from invoice total. 
                        This may indicate missing fee items or other charges not yet synced from Stripe.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </SheetContent>
      </Sheet>

      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.studentModalOpen}
          studentId={modals.selectedStudentId}
          onClose={modals.closeStudentModal}
          onStudentUpdated={() => {}}
        />
      )}

      {modals.selectedSessionId && (
        <SessionModal
          isOpen={modals.sessionModalOpen}
          sessionId={modals.selectedSessionId}
          onClose={modals.closeSessionModal}
        />
      )}
    </>
  );
}

