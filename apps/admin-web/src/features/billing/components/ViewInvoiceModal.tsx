'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Separator, Badge, Button } from '@altitutor/ui';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getInvoiceStatusBadge } from '../utils/invoiceFormatters';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { cn } from '@/shared/utils';
import { useToast } from '@altitutor/ui';
import { format } from 'date-fns';
import { getErrorMessage } from '@/shared/utils';
import {
  useInvoiceData,
  useInvoiceModals,
  useInvoiceActions,
  formatInvoiceDate,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
} from '../index';
import { invoicesKeys } from '../hooks/useInvoicesQuery';

type ViewInvoiceModalProps = {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
};

export function ViewInvoiceModal({ isOpen, invoiceId, onClose }: ViewInvoiceModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  // Business logic hooks
  const invoiceData = useInvoiceData({
    invoiceId: invoiceId,
    enabled: isOpen && !!invoiceId,
  });

  const modals = useInvoiceModals();
  const queryClient = useQueryClient();

  const { invoice, invoiceItems, creditNotes, isLoading } = invoiceData;

  // Fetch Stripe details for retry information
  const { data: stripeDetails, isLoading: isLoadingStripeDetails } = useQuery({
    queryKey: ['invoice-stripe-details', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const response = await fetch(`/api/invoices/${invoiceId}/stripe-details`);
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe details');
      }
      return response.json();
    },
    enabled: isOpen && !!invoiceId && !!invoice?.stripe_invoice_id,
    staleTime: 1000 * 60, // 1 minute
  });

  // Computed values
  const totalAmount = invoice?.amount_due_cents || 0;
  const totalAmountFormatted = `$${(totalAmount / 100).toFixed(2)}`;
  const lineItemsSubtotal = calculateLineItemsSubtotal(invoiceItems);
  const subtotalCents = invoice?.subtotal_cents;
  const totalCents = invoice?.total_cents;
  const amountPaidFromBalanceCents = invoice?.amount_paid_from_balance_cents || 0;
  const hasCreditBalance = amountPaidFromBalanceCents > 0;
  
  // Extract last payment error from metadata
  type InvoiceMetadata = {
    last_payment_error?: {
      code?: string;
      message?: string;
      type?: string;
    } | null;
  };
  const metadata = (invoice?.metadata as InvoiceMetadata | null) ?? null;
  const lastPaymentError = metadata?.last_payment_error || null;
  const collectionMethod = invoice?.collection_method;

  const handleSendInvoiceEmail = async () => {
    if (!invoiceId) return;
    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-invoice`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invoice');
      }

      const result = await response.json();
      const recipients = result.sent || [];
      const recipientText = recipients.length > 0 
        ? `Sent to: ${recipients.join(', ')}`
        : 'Invoice email sent successfully';

      toast({
        title: 'Success',
        description: recipientText,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to send invoice',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleChargeCard = async () => {
    if (!invoiceId || !invoice?.stripe_invoice_id) return;

    // Check if there's a future retry scheduled
    if (stripeDetails?.next_payment_attempt) {
      const nextAttemptDate = new Date(stripeDetails.next_payment_attempt * 1000);
      const formattedDate = format(nextAttemptDate, 'MMM d, yyyy h:mm a');
      
      if (!confirm(`Are you sure you want to attempt this payment now? This payment will already be automatically attempted at ${formattedDate}.`)) {
        return;
      }
    }

    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/charge-card`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to charge card');
      }

      toast({
        title: 'Success',
        description: 'Payment attempt initiated successfully',
      });
      
      // Invalidate invoice queries to refresh data
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: ['invoice-stripe-details', invoiceId] });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to charge card',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAction(false);
    }
  };

  // Centralized action handlers (must be after handler functions are defined)
  const invoiceActions = useInvoiceActions({
    invoiceId: invoiceId || '',
    invoice,
    onOpenInPage: () => {
      router.push(`/invoices/${invoiceId}`);
      onClose();
    },
    onViewOnStripe: invoice?.hosted_invoice_url ? () => {
      window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
    } : undefined,
    onDownloadPdf: invoice?.invoice_pdf ? () => {
      window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
    } : undefined,
    onSendInvoice: collectionMethod === 'send_invoice' && invoice?.status !== 'paid' ? handleSendInvoiceEmail : undefined,
    onChargeCard: collectionMethod === 'charge_automatically' && invoice?.status !== 'paid' ? handleChargeCard : undefined,
    isLoadingAction,
  });

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
                    {...invoiceActions}
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
                    {getInvoiceStatusBadge(invoice.status, invoice.is_refunded)}
                  </div>
                  
                  {subtotalCents !== null && subtotalCents !== undefined && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Subtotal:</div>
                      <div className="text-sm">
                        {formatInvoiceAmount(subtotalCents, invoice.currency || 'AUD')}
                      </div>
                    </>
                  )}
                  
                  {totalCents !== null && totalCents !== undefined && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Total:</div>
                      <div className="text-sm">
                        {formatInvoiceAmount(totalCents, invoice.currency || 'AUD')}
                      </div>
                    </>
                  )}
                  
                  {hasCreditBalance && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Paid from Credit Balance:</div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        {formatInvoiceAmount(amountPaidFromBalanceCents, invoice.currency || 'AUD')}
                      </div>
                    </>
                  )}
                  
                  <div className="text-sm font-medium text-muted-foreground">Amount Due:</div>
                  <div className="text-sm font-semibold">
                    {formatInvoiceAmount(invoice.amount_due_cents, invoice.currency || 'AUD')}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Amount Paid:</div>
                  <div className="text-sm">
                    {formatInvoiceAmount(invoice.amount_paid_cents, invoice.currency || 'AUD')}
                    {hasCreditBalance && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({formatInvoiceAmount(amountPaidFromBalanceCents, invoice.currency || 'AUD')} from credit)
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Collection Method:</div>
                  <div className="text-sm">
                    <Badge variant="outline">
                      {collectionMethod === 'charge_automatically' 
                        ? 'Charge Automatically' 
                        : collectionMethod === 'send_invoice'
                        ? 'Send Invoice'
                        : '—'}
                    </Badge>
                  </div>
                  
                  {collectionMethod === 'charge_automatically' && lastPaymentError && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Last Payment Error:</div>
                      <div className="text-sm text-destructive">
                        {lastPaymentError.code}: {lastPaymentError.message}
                      </div>
                    </>
                  )}
                  
                  {collectionMethod === 'charge_automatically' && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Attempt Count:</div>
                      <div className="text-sm">
                        {isLoadingStripeDetails ? 'Loading...' : stripeDetails?.attempt_count ?? '—'}
                      </div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Next Payment Attempt:</div>
                      <div className="text-sm">
                        {isLoadingStripeDetails 
                          ? 'Loading...' 
                          : stripeDetails?.next_payment_attempt
                          ? format(new Date(stripeDetails.next_payment_attempt * 1000), 'MMM d, yyyy h:mm a')
                          : 'No retry scheduled'}
                      </div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Auto Retry Active:</div>
                      <div className="text-sm">
                        {isLoadingStripeDetails 
                          ? 'Loading...' 
                          : stripeDetails?.auto_retry_active 
                          ? <Badge variant="default">Yes</Badge>
                          : <Badge variant="secondary">No</Badge>}
                      </div>
                    </>
                  )}
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
                    
                    {/* Totals Breakdown */}
                    {subtotalCents !== null && subtotalCents !== undefined && (
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="text-sm text-muted-foreground">Subtotal:</div>
                        <div className="text-sm">{formatInvoiceAmount(subtotalCents, invoice.currency || 'AUD')}</div>
                      </div>
                    )}
                    {totalCents !== null && totalCents !== undefined && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Total:</div>
                        <div className="text-sm">{formatInvoiceAmount(totalCents, invoice.currency || 'AUD')}</div>
                      </div>
                    )}
                    {hasCreditBalance && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Credit Applied:</div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          -{formatInvoiceAmount(amountPaidFromBalanceCents, invoice.currency || 'AUD')}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t font-semibold">
                      <div className="text-sm">Amount Due:</div>
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

              {/* Credit Notes and Refunds */}
              {(creditNotes.length > 0 || invoice.is_refunded) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Refunds & Credits</h3>
                    
                    {/* Direct Refund */}
                    {invoice.is_refunded && (
                      <div className="mb-3 p-3 rounded-md border bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="destructive" className="text-xs">Refunded</Badge>
                              {invoice.refunded_at && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(invoice.refunded_at), 'MMM d, yyyy h:mm a')}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Charge was refunded directly from Stripe Dashboard
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Credit Notes */}
                    {creditNotes.length > 0 && (
                      <div className="space-y-3">
                        {creditNotes.map((creditNote) => (
                          <div
                            key={creditNote.id}
                            className={cn(
                              "p-3 rounded-md border",
                              creditNote.status === 'void' && "opacity-60 bg-muted/30"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge 
                                    variant={creditNote.status === 'void' ? 'outline' : 'secondary'} 
                                    className="text-xs"
                                  >
                                    Credit Note
                                  </Badge>
                                  {creditNote.status === 'void' && (
                                    <Badge variant="outline" className="text-xs">Void</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(creditNote.created_at), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                {creditNote.reason && (
                                  <div className="text-sm text-muted-foreground mb-1">
                                    {creditNote.reason}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  Status: {creditNote.status}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-green-600 dark:text-green-400 ml-4">
                                -{formatInvoiceAmount(creditNote.amount_cents, creditNote.currency)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

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

