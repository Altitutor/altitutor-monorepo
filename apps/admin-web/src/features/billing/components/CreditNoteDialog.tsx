'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Button,
  Label,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useToast,
  SearchableSelect,
  SearchableSelectFieldTrigger,
  SmartDatePickerField,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { getInvoiceStatusBadge, formatInvoiceAmount, toInvoiceStatusPayload } from '../utils/invoiceFormatters';
import { formatCreditAmountInput, getCreditAmountError, parseCreditAmountCents } from '../utils/creditNoteAmounts';
import type { InvoiceItemRow } from '../types';
import type { CreateCreditNoteRequest } from '../types';
import { getErrorMessage } from '@/shared/utils';
import { AdminDialogShell } from '@/shared/components';

const CREDIT_NOTE_REASONS: { id: string; label: string }[] = [
  { id: 'duplicate', label: 'Duplicate charge' },
  { id: 'product_unsatisfactory', label: 'Product unsatisfactory' },
  { id: 'order_change', label: 'Order change' },
  { id: 'fraudulent', label: 'Fraudulent charge' },
  { id: 'other', label: 'Other' },
];

const DESTINATION_OPTIONS = [
  { id: 'refund', label: 'Refund to card' },
  { id: 'credit_balance', label: "Credit customer's balance" },
  { id: 'out_of_band', label: 'Credit outside of Stripe (e.g., cash)' },
] as const;

type LineState = { selected: boolean; amount: string };

export interface CreditNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoice: {
    stripe_invoice_id: string | null;
    stripe_invoice_number: string | null;
    amount_due_cents: number | null;
    currency: string | null;
    status: string | null;
  };
  invoiceItems: InvoiceItemRow[];
  onSuccess: () => void;
}

export function CreditNoteDialog({
  isOpen,
  onClose,
  invoiceId,
  invoice,
  invoiceItems,
  onSuccess,
}: CreditNoteDialogProps) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const { toast } = useToast();
  const [reason, setReason] = useState<CreateCreditNoteRequest['reason']>('duplicate');
  const [effectiveDateEnabled, setEffectiveDateEnabled] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [destination, setDestination] = useState<'refund' | 'credit_balance' | 'out_of_band'>('credit_balance');
  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setIdempotencyKey(crypto.randomUUID());
  }, [isOpen]);

  const itemsWithStripeId = useMemo(() => invoiceItems.filter((item) => item.stripe_invoice_item_id), [invoiceItems]);
  const missingStripeIds = invoiceItems.length > 0 && itemsWithStripeId.length < invoiceItems.length;

  useEffect(() => {
    if (!isOpen || invoiceItems.length === 0) return;
    const initial: Record<string, LineState> = {};
    itemsWithStripeId.forEach((item) => {
      initial[item.id] = {
        selected: true,
        amount: formatCreditAmountInput(item.amount_cents ?? 0),
      };
    });
    setLineState(initial);
  }, [isOpen, invoiceItems, itemsWithStripeId]);

  const amountToCreditCents = useMemo(() => {
    return itemsWithStripeId.reduce((sum, item) => {
      const state = lineState[item.id];
      if (!state?.selected) return sum;

      return sum + (parseCreditAmountCents(state.amount) ?? 0);
    }, 0);
  }, [itemsWithStripeId, lineState]);

  const hasInvalidSelectedAmount = useMemo(
    () =>
      itemsWithStripeId.some((item) => {
        const state = lineState[item.id];
        return state?.selected && getCreditAmountError(state.amount, item.amount_cents ?? 0) !== null;
      }),
    [itemsWithStripeId, lineState],
  );

  const allSelected = itemsWithStripeId.length > 0 && itemsWithStripeId.every((i) => lineState[i.id]?.selected);
  const setAllSelected = useCallback(
    (checked: boolean) => {
      setLineState((prev) => {
        const next = { ...prev };
        itemsWithStripeId.forEach((item) => {
          next[item.id] = {
            selected: checked,
            amount: prev[item.id]?.amount ?? formatCreditAmountInput(item.amount_cents ?? 0),
          };
        });
        return next;
      });
    },
    [itemsWithStripeId],
  );

  const handleSubmit = async () => {
    const selectedLines = itemsWithStripeId.filter((item) => lineState[item.id]?.selected);
    if (selectedLines.length === 0) {
      toast({
        title: 'Error',
        description: 'Select at least one line to credit',
        variant: 'destructive',
      });
      return;
    }
    if (amountToCreditCents <= 0) {
      toast({
        title: 'Error',
        description: 'Amount to credit must be greater than zero',
        variant: 'destructive',
      });
      return;
    }
    if (hasInvalidSelectedAmount) {
      toast({
        title: 'Error',
        description: 'Enter a valid credit amount for each selected line',
        variant: 'destructive',
      });
      return;
    }

    const body: CreateCreditNoteRequest = {
      reason,
      lines: selectedLines.map((item) => ({
        stripeInvoiceItemId: item.stripe_invoice_item_id,
        amount_cents: parseCreditAmountCents(lineState[item.id].amount)!,
      })),
      memo: memo.trim() || undefined,
      effective_at: effectiveDateEnabled ? new Date(effectiveDate).toISOString() : undefined,
      internal_note: internalNote.trim() || undefined,
    };

    // Only send destination amounts for paid invoices (open invoices just reduce amount due)
    if (invoice.status === 'paid') {
      if (destination === 'refund') body.refund_amount_cents = amountToCreditCents;
      else if (destination === 'credit_balance') body.credit_amount_cents = amountToCreditCents;
      else body.out_of_band_amount_cents = amountToCreditCents;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `manual-credit-note-${invoiceId}-${idempotencyKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to issue credit note');
      }
      toast({
        title: 'Success',
        description: 'Credit note issued successfully',
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) ?? 'Failed to issue credit note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = invoice.currency ?? 'AUD';
  const isPaidInvoice = invoice.status === 'paid';
  const creditImpact = isPaidInvoice
    ? destination === 'refund'
      ? `This will refund ${formatInvoiceAmount(amountToCreditCents, currency)} to the payment method used for this invoice.`
      : destination === 'credit_balance'
        ? `This will apply ${formatInvoiceAmount(amountToCreditCents, currency)} to the student's balance, which Stripe will automatically use on future invoices.`
        : `This will record ${formatInvoiceAmount(amountToCreditCents, currency)} as credited outside Stripe. Stripe will not move any money.`
    : `This will reduce the amount due on this invoice by ${formatInvoiceAmount(amountToCreditCents, currency)}.`;

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={onClose}
      title="Issue a credit note"
      subtitle="Adjust or refund finalised invoices with credit notes."
      contentClassName="md:max-w-4xl"
      bodyClassName="!p-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || missingStripeIds || amountToCreditCents <= 0 || hasInvalidSelectedAmount}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Issuing…
              </>
            ) : (
              'Issue credit note'
            )}
          </Button>
        </>
      }
    >
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Invoice (read-only) */}
            <div className="space-y-2">
              <Label>Invoice</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">
                  #{invoice.stripe_invoice_number ?? invoiceId.slice(0, 8)} for{' '}
                  {formatInvoiceAmount(invoice.amount_due_cents, currency)}
                </span>
                {invoice.status && getInvoiceStatusBadge(toInvoiceStatusPayload({ status: invoice.status }))}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="credit-note-reason">Reason</Label>
              <SearchableSelect<{ id: string; label: string }>
                items={CREDIT_NOTE_REASONS}
                value={CREDIT_NOTE_REASONS.find((r) => r.id === reason) ?? null}
                onValueChange={(v) => v && setReason(v.id as CreateCreditNoteRequest['reason'])}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.label}
                placeholder="Select reason"
                trigger={
                  <SearchableSelectFieldTrigger id="credit-note-reason">
                    {CREDIT_NOTE_REASONS.find((r) => r.id === reason)?.label ?? 'Select reason'}
                  </SearchableSelectFieldTrigger>
                }
              />
            </div>

            {/* Effective date */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="effective-date-checkbox"
                checked={effectiveDateEnabled}
                onCheckedChange={(c) => setEffectiveDateEnabled(c === true)}
              />
              <Label htmlFor="effective-date-checkbox" className="font-normal cursor-pointer">
                Set an effective date
              </Label>
              {effectiveDateEnabled && (
                <SmartDatePickerField
                  value={effectiveDate}
                  onChange={(value) => setEffectiveDate(value ?? '')}
                  className="w-40"
                />
              )}
            </div>

            {/* Items to credit */}
            <div className="space-y-2">
              <Label>Items to credit</Label>
              {missingStripeIds && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Some invoice items are missing Stripe line item IDs and cannot be credited.
                </p>
              )}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Checkbox checked={allSelected} onCheckedChange={(c) => setAllSelected(c === true)} />
                          <span className="text-xs font-medium">Credit all</span>
                        </div>
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Credit Qty</TableHead>
                      <TableHead className="w-24 text-right">Unit price</TableHead>
                      <TableHead className="w-44 text-right">Credit Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsWithStripeId.map((item) => {
                      const selected = lineState[item.id]?.selected ?? false;
                      const unitCents = item.amount_cents ?? 0;
                      const amount = lineState[item.id]?.amount ?? formatCreditAmountInput(unitCents);
                      const amountError = selected ? getCreditAmountError(amount, unitCents) : null;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(c) =>
                                setLineState((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    selected: c === true,
                                    amount: prev[item.id]?.amount ?? formatCreditAmountInput(unitCents),
                                  },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-sm">{item.description ?? '—'}</TableCell>
                          <TableCell className="text-sm">1</TableCell>
                          <TableCell className="text-right text-sm">
                            {formatInvoiceAmount(unitCents, currency)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <div className="ml-auto max-w-36 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">$</span>
                                <Input
                                  aria-label={`Credit amount for ${item.description ?? 'invoice item'}`}
                                  aria-invalid={amountError !== null}
                                  className="h-8 text-right"
                                  disabled={!selected}
                                  inputMode="decimal"
                                  max={formatCreditAmountInput(unitCents)}
                                  min="0.01"
                                  step="0.01"
                                  type="number"
                                  value={amount}
                                  onChange={(event) =>
                                    setLineState((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        selected: prev[item.id]?.selected ?? false,
                                        amount: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-4 text-sm mt-2">
                <span className="text-muted-foreground">Amount to credit:</span>
                <span className="font-medium">{formatInvoiceAmount(amountToCreditCents, currency)}</span>
              </div>
            </div>

            {/* How to credit (only for paid invoices) */}
            {isPaidInvoice &&
              (() => {
                const destinationItems = DESTINATION_OPTIONS.map((d) => ({
                  id: d.id,
                  label:
                    d.id === 'refund'
                      ? `${d.label} (maximum ${formatInvoiceAmount(amountToCreditCents, currency)})`
                      : d.label,
                }));
                const selectedDestination = destinationItems.find((it) => it.id === destination) ?? null;
                return (
                  <div className="space-y-2">
                    <Label>How to credit</Label>
                    <SearchableSelect<{ id: string; label: string }>
                      items={destinationItems}
                      value={selectedDestination}
                      onValueChange={(v) => v && setDestination(v.id as typeof destination)}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.label}
                      placeholder="Select how to credit"
                      trigger={
                        <SearchableSelectFieldTrigger>
                          {selectedDestination?.label ?? 'Select how to credit'}
                        </SearchableSelectFieldTrigger>
                      }
                    />
                  </div>
                );
              })()}

            {/* Memo */}
            <div className="space-y-2">
              <Label htmlFor="credit-note-memo">Memo</Label>
              <p className="text-xs text-muted-foreground">Appears on the credit note PDF</p>
              <Textarea
                id="credit-note-memo"
                maxLength={500}
                rows={3}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Optional memo"
              />
            </div>

            {/* Internal note */}
            <div className="space-y-2">
              <Label htmlFor="credit-note-internal">Add internal note</Label>
              <Input
                id="credit-note-internal"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Optional internal note (not shown on PDF)"
                maxLength={500}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-4 text-sm font-medium" role="status">
              {creditImpact}
            </div>
          </div>
        </div>
      </div>
    </AdminDialogShell>
  );
}
