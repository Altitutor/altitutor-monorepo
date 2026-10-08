"use client";
import { PrimaryEntityBreadcrumb } from "@/shared/components/PrimaryEntityBreadcrumb";

import { useRouter } from "next/navigation";
import { Button, Separator, Badge } from "@altitutor/ui";
import { ArrowLeft } from "lucide-react";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { ViewStudentModal } from "@/features/students/components/ViewStudentModal";
import { SessionModal } from "@/features/sessions/components/SessionModal";
import { cn } from "@/shared/utils";
import {
  useInvoiceData,
  useInvoiceModals,
  useInvoiceActions,
  formatInvoiceDate,
  getInvoiceStatusBadge,
  toInvoiceStatusPayload,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
  formatInvoiceTagText,
  CreditNoteDialog,
} from "@/features/billing";
import { useState } from "react";
import { useToast } from "@altitutor/ui";
import { getErrorMessage } from "@/shared/utils";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLoadingSkeleton } from "@/shared/components";
import {
  PropertyForm,
  PropertyFormRow,
} from "@/shared/components/PropertyForm";
import { invalidateInvoiceDetail } from "@/shared/lib/query-invalidation";
import {
  storedCreditNoteDetails,
  formatCreditNoteReason,
  type CreditNoteDetails,
} from "@/features/billing/utils/creditNoteDetails";
import { InvoiceActivityTab } from "@/features/activity/components";

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  const {
    invoice,
    invoiceItems,
    creditNotes: storedCreditNotes,
    isLoading,
  } = invoiceData;

  // Fetch Stripe details for retry information
  const {
    data: stripeDetails,
    isLoading: isLoadingStripeDetails,
    isError: isStripeDetailsError,
  } = useQuery({
    queryKey: ["invoice-stripe-details", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(
        `/api/invoices/${id}/stripe-details?include_credit_notes=true`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch Stripe details");
      }
      return response.json() as Promise<{
        credit_notes?: CreditNoteDetails[];
        amount_paid_cents?: number;
        amount_remaining_cents?: number;
        attempt_count: number;
        next_payment_attempt: number | null;
        auto_retry_active: boolean;
        last_payment_error?: { code?: string; message?: string } | null;
      }>;
    },
    enabled: !!id && !!invoice?.stripe_invoice_id,
    staleTime: 1000 * 60, // 1 minute
  });

  const creditNotesById = new Map(
    storedCreditNotes.map((note) => [
      note.stripe_credit_note_id,
      storedCreditNoteDetails(note),
    ]),
  );
  for (const note of stripeDetails?.credit_notes ?? [])
    creditNotesById.set(note.stripe_credit_note_id, note);
  const creditNotes = [...creditNotesById.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const isRefunded = !!invoice?.is_refunded;

  const totalCreditNotesCents = creditNotes
    .filter((note) => note.status !== "void")
    .reduce((sum, note) => sum + note.amount_cents, 0);

  const invoiceTotalCents =
    invoice?.total_cents ?? invoice?.amount_due_cents ?? 0;

  const isFullyCredited =
    totalCreditNotesCents >= invoiceTotalCents && invoiceTotalCents > 0;

  // Extract last payment error from metadata
  type InvoiceMetadata = {
    last_payment_error?: {
      code?: string;
      message?: string;
      type?: string;
    } | null;
  };
  const metadata = (invoice?.metadata as InvoiceMetadata | null) ?? null;
  const lastPaymentError =
    stripeDetails?.last_payment_error ?? metadata?.last_payment_error ?? null;
  const collectionMethod = invoice?.collection_method;

  const handleSendInvoiceEmail = async () => {
    if (!id) return;
    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${id}/send-invoice`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invoice");
      }

      const result = await response.json();
      const recipients = result.sent || [];
      const recipientText =
        recipients.length > 0
          ? `Sent to: ${recipients.join(", ")}`
          : "Invoice email sent successfully";

      toast({
        title: "Success",
        description: recipientText,
      });
      await invalidateInvoiceDetail(queryClient, id);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to send invoice",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleChargeCard = async () => {
    if (!id || !invoice?.stripe_invoice_id) return;

    // Check if there's a future retry scheduled
    if (stripeDetails?.next_payment_attempt) {
      const nextAttemptDate = new Date(
        stripeDetails.next_payment_attempt * 1000,
      );
      const formattedDate = format(nextAttemptDate, "MMM d, yyyy h:mm a");

      if (
        !confirm(
          `Are you sure you want to attempt this payment now? This payment will already be automatically attempted at ${formattedDate}.`,
        )
      ) {
        return;
      }
    }

    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${id}/charge-card`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to charge card");
      }

      toast({
        title: "Success",
        description: "Payment attempt initiated successfully",
      });

      await invalidateInvoiceDetail(queryClient, id);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to charge card",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAction(false);
    }
  };

  const canInvoiceAcceptCreditNote =
    !!invoice &&
    (invoice.status === "open" || invoice.status === "paid") &&
    !!invoice.stripe_invoice_id;

  const handleOpenCreditNoteDialog = () => {
    if (!id || !invoice) return;
    if (isRefunded) {
      toast({
        title: "Cannot add credit note",
        description: "This invoice has already been refunded.",
        variant: "destructive",
      });
      return;
    }
    if (isFullyCredited) {
      toast({
        title: "Cannot add credit note",
        description: "This invoice has already been fully credited.",
        variant: "destructive",
      });
      return;
    }
    setIsCreditNoteOpen(true);
  };

  // Centralized action handlers
  const invoiceActions = useInvoiceActions({
    invoiceId: id,
    invoice,
    onDownloadPdf: invoice?.invoice_pdf
      ? () => {
          window.open(invoice.invoice_pdf!, "_blank", "noopener,noreferrer");
        }
      : undefined,
    onSendInvoice:
      collectionMethod === "send_invoice" && invoice?.status !== "paid"
        ? handleSendInvoiceEmail
        : undefined,
    onChargeCard:
      collectionMethod === "charge_automatically" && invoice?.status !== "paid"
        ? handleChargeCard
        : undefined,
    onAddCreditNote:
      invoice &&
      (invoice.status === "open" || invoice.status === "paid") &&
      invoice.stripe_invoice_id
        ? handleOpenCreditNoteDialog
        : undefined,
    isLoadingAction,
  });

  // Computed values
  const totalAmount =
    invoice?.total_cents ??
    invoice?.subtotal_cents ??
    invoice?.amount_due_cents ??
    0;
  const totalAmountFormatted = `$${(totalAmount / 100).toFixed(2)}`;
  const lineItemsSubtotal = calculateLineItemsSubtotal(invoiceItems);
  const subtotalCents = invoice?.subtotal_cents;
  const totalCents = invoice?.total_cents;

  if (isLoading) {
    return <AdminLoadingSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/invoices")}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            Invoice Not Found
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <PrimaryEntityBreadcrumb
          label={formatInvoiceTagText({
            invoiceDate: invoice.invoice_date,
            lineItemDescriptions: invoiceItems.map(
              (item) => item.description || "Invoice item",
            ),
            status: invoice.status,
          })}
        />

        <ActionsMenu
          type="invoice"
          entityId={id}
          copyTagDisplayText={formatInvoiceTagText({
            invoiceDate: invoice.invoice_date,
            lineItemDescriptions: invoiceItems.map(
              (item) => item.description || "Invoice item",
            ),
            status: invoice.status,
          })}
          isAddCreditNoteDisabled={
            canInvoiceAcceptCreditNote && (isFullyCredited || isRefunded)
          }
          addCreditNoteDisabledReason={
            isRefunded
              ? "This invoice has already been refunded."
              : "This invoice has already been fully credited."
          }
          {...invoiceActions}
        />
      </div>

      <div className="space-y-6">
        {/* Invoice Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Invoice Information</h3>
          <PropertyForm>
            <PropertyFormRow label="Student">
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
            </PropertyFormRow>
            <PropertyFormRow label="Invoice date">
              <div className="text-sm">
                {formatInvoiceDate(invoice.invoice_date)}
              </div>
            </PropertyFormRow>
            <PropertyFormRow label="Status">
              <div className="text-sm">
                {getInvoiceStatusBadge(
                  toInvoiceStatusPayload({
                    ...invoice,
                    credit_notes: creditNotes
                      .filter((note) => note.status !== "void")
                      .map((note) => ({
                        amount_cents: note.amount_cents,
                        out_of_band_amount_cents: note.out_of_band_amount_cents,
                        refund_amount_cents: note.refund_amount_cents,
                        credit_amount_cents: note.credit_amount_cents,
                        created_at: note.created_at,
                      })),
                  }),
                )}
              </div>
            </PropertyFormRow>
            {subtotalCents !== null && subtotalCents !== undefined && (
              <PropertyFormRow label="Subtotal">
                <div className="text-sm">
                  {formatInvoiceAmount(
                    subtotalCents,
                    invoice.currency || "AUD",
                  )}
                </div>
              </PropertyFormRow>
            )}
            {totalCents !== null && totalCents !== undefined && (
              <PropertyFormRow label="Total">
                <div className="text-sm">
                  {formatInvoiceAmount(totalCents, invoice.currency || "AUD")}
                </div>
              </PropertyFormRow>
            )}
            <PropertyFormRow label="Amount paid">
              <div className="text-sm">
                {formatInvoiceAmount(
                  stripeDetails?.amount_paid_cents ?? invoice.amount_paid_cents,
                  invoice.currency || "AUD",
                )}
                <p className="text-xs text-muted-foreground">
                  Payment recorded on this invoice, before refunds. Balance
                  credits are separate.
                </p>
              </div>
            </PropertyFormRow>
            <PropertyFormRow
              label={
                invoice.status === "paid"
                  ? "Amount remaining"
                  : "Invoice amount due"
              }
            >
              <div className="text-sm font-semibold">
                {formatInvoiceAmount(
                  stripeDetails?.amount_remaining_cents ??
                    (invoice.status === "paid" ? 0 : invoice.amount_due_cents),
                  invoice.currency || "AUD",
                )}
              </div>
            </PropertyFormRow>
            <PropertyFormRow label="Collection method">
              <div>
                <Badge variant="outline">
                  {collectionMethod === "charge_automatically"
                    ? "Charge Automatically"
                    : collectionMethod === "send_invoice"
                      ? "Send Invoice"
                      : "—"}
                </Badge>
              </div>
            </PropertyFormRow>
            {collectionMethod === "charge_automatically" &&
              lastPaymentError && (
                <PropertyFormRow label="Last payment error">
                  <div className="text-sm text-destructive">
                    {lastPaymentError.code}: {lastPaymentError.message}
                  </div>
                </PropertyFormRow>
              )}
            {collectionMethod === "charge_automatically" && (
              <>
                <PropertyFormRow label="Attempt count">
                  <div className="text-sm">
                    {isStripeDetailsError
                      ? "Unable to load"
                      : isLoadingStripeDetails
                        ? "Loading..."
                        : (stripeDetails?.attempt_count ?? "—")}
                  </div>
                </PropertyFormRow>
                <PropertyFormRow label="Next payment attempt">
                  <div className="text-sm">
                    {isStripeDetailsError
                      ? "Unable to load"
                      : isLoadingStripeDetails
                        ? "Loading..."
                        : stripeDetails?.next_payment_attempt
                          ? format(
                              new Date(
                                stripeDetails.next_payment_attempt * 1000,
                              ),
                              "MMM d, yyyy h:mm a",
                            )
                          : "No retry scheduled"}
                  </div>
                </PropertyFormRow>
                <PropertyFormRow label="Auto retry active">
                  <div className="text-sm">
                    {isStripeDetailsError ? (
                      "Unable to load"
                    ) : isLoadingStripeDetails ? (
                      "Loading..."
                    ) : stripeDetails?.auto_retry_active ? (
                      <Badge variant="default">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </div>
                </PropertyFormRow>
              </>
            )}
          </PropertyForm>
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
                    item.session_id &&
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                  )}
                  onClick={() => {
                    if (item.session_id) {
                      modals.openSessionModal(item.session_id);
                    }
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          item.is_subsidy &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {item.description || "Invoice item"}
                      </span>
                      {item.is_subsidy && (
                        <Badge variant="outline" className="text-xs">
                          Subsidy
                        </Badge>
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
                <div className="text-sm">Original invoice total</div>
                <div className="text-sm">{totalAmountFormatted}</div>
              </div>

              {totalCreditNotesCents > 0 && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Credit notes applied</span>
                    <span>
                      -
                      {formatInvoiceAmount(
                        totalCreditNotesCents,
                        invoice.currency || "AUD",
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Net invoice value</span>
                    <span>
                      {formatInvoiceAmount(
                        Math.max(0, totalAmount - totalCreditNotesCents),
                        invoice.currency || "AUD",
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Original invoice total minus credit notes. This is not the
                    amount paid or refunded. See Refunds &amp; Credits for each
                    credit note’s outcome.
                  </p>
                </div>
              )}

              {/* Compare original charges, independently of payments and credits. */}
              {Math.abs(totalAmount - lineItemsSubtotal) > 1 && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  Note: Line items total ($
                  {(lineItemsSubtotal / 100).toFixed(2)}) differs from the
                  original invoice total. Check for taxes, discounts, fees or
                  line items not yet synced from Stripe. Credit notes are listed
                  separately and do not change the original line items.
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h3 className="text-lg font-semibold mb-4">Activity</h3>
          <InvoiceActivityTab invoiceId={id} isOpen />
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
                        <Badge variant="destructive" className="text-xs">
                          Refunded
                        </Badge>
                        {invoice.refunded_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(invoice.refunded_at),
                              "MMM d, yyyy h:mm a",
                            )}
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
                        creditNote.status === "void" &&
                          "opacity-60 bg-muted/30",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={
                                creditNote.status === "void"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              Credit Note
                            </Badge>
                            {creditNote.status === "void" && (
                              <Badge variant="outline" className="text-xs">
                                Void
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(creditNote.created_at),
                                "MMM d, yyyy",
                              )}
                            </span>
                          </div>
                          {creditNote.reason && (
                            <div className="text-sm text-muted-foreground mb-1">
                              Reason:{" "}
                              {formatCreditNoteReason(creditNote.reason)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Status: {creditNote.status}
                          </div>
                          {creditNote.memo && (
                            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              Memo: {creditNote.memo}
                            </div>
                          )}
                          {creditNote.internal_note && (
                            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              Internal note: {creditNote.internal_note}
                            </div>
                          )}
                          {creditNote.status === "void" ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Voided credit note — not included in the net
                              invoice value.
                            </p>
                          ) : !creditNote.outcome_verified ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {isLoadingStripeDetails
                                ? "Loading credit note outcome…"
                                : "Credit note outcome unavailable. Check Stripe for the payment breakdown."}
                            </p>
                          ) : null}
                          {creditNote.status !== "void" &&
                            (creditNote.pre_payment_amount_cents ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Reduced unpaid invoice amount (before payment){" "}
                                {formatInvoiceAmount(
                                  creditNote.pre_payment_amount_cents!,
                                  creditNote.currency,
                                )}
                              </div>
                            )}
                          {creditNote.status !== "void" &&
                            creditNote.outcome_verified &&
                            (creditNote.refund_amount_cents ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Refund (after payment){" "}
                                {formatInvoiceAmount(
                                  creditNote.refund_amount_cents!,
                                  creditNote.currency,
                                )}
                              </div>
                            )}
                          {creditNote.status !== "void" &&
                            creditNote.outcome_verified &&
                            (creditNote.credit_amount_cents ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Credited to customer balance (after payment){" "}
                                {formatInvoiceAmount(
                                  creditNote.credit_amount_cents!,
                                  creditNote.currency,
                                )}
                              </div>
                            )}
                          {creditNote.status !== "void" &&
                            creditNote.outcome_verified &&
                            (creditNote.out_of_band_amount_cents ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Settled externally (after payment){" "}
                                {formatInvoiceAmount(
                                  creditNote.out_of_band_amount_cents!,
                                  creditNote.currency,
                                )}
                              </div>
                            )}
                        </div>
                        <div className="text-sm font-medium text-green-600 dark:text-green-400 ml-4">
                          -
                          {formatInvoiceAmount(
                            creditNote.amount_cents,
                            creditNote.currency,
                          )}
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
        <div></div>
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
            void invalidateInvoiceDetail(queryClient, id);
          }}
        />
      )}
    </div>
  );
}
