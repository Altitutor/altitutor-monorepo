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
  useInvoiceActions,
  formatInvoiceDate,
  getInvoiceStatusBadge,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
  formatInvoiceTagText,
  CreditNoteDialog,
} from '@/features/billing';
import { useState } from 'react';
import { useToast } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesKeys } from '@/features/billing/hooks/useInvoicesQuery';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [isCreditNoteOpen, setIsCreditNoteOpen] = useState(false);

  // Business logic hooks
  const invoiceData = useInvoiceData({
    invoiceId: id,
    enabled: !!id,
  });

  const modals = useInvoiceModals();

  const { invoice, invoiceItems, creditNotes, isLoading } = invoiceData;

  // Fetch Stripe details for retry information
  const { data: stripeDetails } = useQuery({
    queryKey: ['invoice-stripe-details', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/invoices/${id}/stripe-details`);
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe details');
      }
      return response.json();
    },
    enabled: !!id && !!invoice?.stripe_invoice_id,
    staleTime: 1000 * 60, // 1 minute
  });

  const collectionMethod = invoice?.collection_method;

  const handleSendInvoiceEmail = async () => {
    if (!id) return;
    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${id}/send-invoice`, {
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
    if (!id || !invoice?.stripe_invoice_id) return;

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
      const response = await fetch(`/api/invoices/${id}/charge-card`, {
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
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['invoice-stripe-details', id] });
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

  // Centralized action handlers
  const invoiceActions = useInvoiceActions({
    invoiceId: id,
    invoice,
    onViewOnStripe: invoice?.hosted_invoice_url ? () => {
      window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
    } : undefined,
    onDownloadPdf: invoice?.invoice_pdf ? () => {
      window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
    } : undefined,
    onSendInvoice: collectionMethod === 'send_invoice' && invoice?.status !== 'paid' ? handleSendInvoiceEmail : undefined,
    onChargeCard: collectionMethod === 'charge_automatically' && invoice?.status !== 'paid' ? handleChargeCard : undefined,
    onAddCreditNote:
      invoice && (invoice.status === 'open' || invoice.status === 'paid') && invoice.stripe_invoice_id
        ? () => setIsCreditNoteOpen(true)
        : undefined,
    isLoadingAction,
  });

  // Computed values
  const totalAmount = invoice?.amount_due_cents || 0;
  const totalAmountFormatted = `$${(totalAmount / 100).toFixed(2)}`;
  const lineItemsSubtotal = calculateLineItemsSubtotal(invoiceItems);
  const subtotalCents = invoice?.subtotal_cents;
  const totalCents = invoice?.total_cents;
  const amountPaidFromBalanceCents = invoice?.amount_paid_from_balance_cents || 0;
  const hasCreditBalance = amountPaidFromBalanceCents > 0;

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
          entityId={id}
          copyTagDisplayText={formatInvoiceTagText({
            invoiceDate: invoice.invoice_date,
            lineItemDescriptions: invoiceItems.map((item) => item.description || 'Invoice item'),
            status: invoice.status,
          })}
          {...invoiceActions}
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
            <div className="text-sm">
              {getInvoiceStatusBadge({
                status: invoice.status,
                paid_at: invoice.paid_at,
                refunded_at: invoice.refunded_at,
                has_credit_notes: invoice.has_credit_notes,
                is_refunded: invoice.is_refunded,
              })}
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

      {/* Credit Note Dialog */}
      {invoice && isCreditNoteOpen && (
        <CreditNoteDialog
          isOpen={true}
          onClose={() => setIsCreditNoteOpen(false)}
          invoiceId={id}
          invoice={{
            stripe_invoice_id: invoice.stripe_invoice_id,
            stripe_invoice_number: invoice.stripe_invoice_number,
            amount_due_cents: invoice.amount_due_cents,
            currency: invoice.currency,
            status: invoice.status,
          }}
          invoiceItems={invoiceItems}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: [...invoicesKeys.details(), id, 'credit-notes'] });
          }}
        />
      )}
    </div>
  );
}
