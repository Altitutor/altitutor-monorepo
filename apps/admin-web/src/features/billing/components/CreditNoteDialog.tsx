'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
} from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { getInvoiceStatusBadge, formatInvoiceAmount, toInvoiceStatusPayload } from '../utils/invoiceFormatters';
import type { InvoiceItemRow } from '../types';
import type { CreateCreditNoteRequest } from '../types';
import { getErrorMessage } from '@/shared/utils';

const CREDIT_NOTE_REASONS = [
  { value: 'duplicate', label: 'Duplicate charge' },
  { value: 'product_unsatisfactory', label: 'Product unsatisfactory' },
  { value: 'order_change', label: 'Order change' },
  { value: 'fraudulent', label: 'Fraudulent charge' },
  { value: 'other', label: 'Other' },
] as const;

const DESTINATION_OPTIONS = [
  { value: 'refund', label: 'Refund to card' },
  { value: 'credit_balance', label: "Credit customer's balance" },
  { value: 'out_of_band', label: 'Credit outside of Stripe (e.g., cash)' },
] as const;

type LineState = { selected: boolean };

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
  const { toast } = useToast();
  const [reason, setReason] = useState<CreateCreditNoteRequest['reason']>('duplicate');
  const [effectiveDateEnabled, setEffectiveDateEnabled] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [memo, setMemo] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [destination, setDestination] = useState<'refund' | 'credit_balance' | 'out_of_band'>('credit_balance');
  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsWithStripeId = useMemo(
    () => invoiceItems.filter((item) => item.stripe_invoice_item_id),
    [invoiceItems]
  );
  const missingStripeIds = invoiceItems.length > 0 && itemsWithStripeId.length < invoiceItems.length;

  useEffect(() => {
    if (!isOpen || invoiceItems.length === 0) return;
    const initial: Record<string, LineState> = {};
    itemsWithStripeId.forEach((item) => {
      initial[item.id] = { selected: true };
    });
    setLineState(initial);
  }, [isOpen, invoiceItems, itemsWithStripeId]);

  const amountToCreditCents = useMemo(() => {
    return itemsWithStripeId.reduce(
      (sum, item) => (lineState[item.id]?.selected ? sum + (item.amount_cents ?? 0) : sum),
      0
    );
  }, [itemsWithStripeId, lineState]);

  const allSelected = itemsWithStripeId.length > 0 && itemsWithStripeId.every((i) => lineState[i.id]?.selected);
  const setAllSelected = useCallback(
    (checked: boolean) => {
      setLineState((prev) => {
        const next = { ...prev };
        itemsWithStripeId.forEach((item) => {
          next[item.id] = { selected: checked };
        });
        return next;
      });
    },
    [itemsWithStripeId]
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

    const body: CreateCreditNoteRequest = {
      reason,
      lines: selectedLines.map((item) => ({
        stripeInvoiceItemId: item.stripe_invoice_item_id,
        quantity: 1,
        amount_cents: item.amount_cents ?? 0,
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
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
                <div className="flex-1 min-w-0">
                  <DialogTitle>Issue a credit note</DialogTitle>
                  <DialogDescription asChild>
                    <span>
                      Adjust or refund finalised invoices with credit notes.
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
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
              {invoice.status &&
                getInvoiceStatusBadge(toInvoiceStatusPayload({ status: invoice.status }))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="credit-note-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CreateCreditNoteRequest['reason'])}>
              <SelectTrigger id="credit-note-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_NOTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
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
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(c) => setAllSelected(c === true)}
                        />
                        <span className="text-xs font-medium">Credit all</span>
                      </div>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Credit Qty</TableHead>
                    <TableHead className="w-24 text-right">Unit price</TableHead>
                    <TableHead className="w-28 text-right">Credit Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsWithStripeId.map((item) => {
                    const selected = lineState[item.id]?.selected ?? false;
                    const unitCents = item.amount_cents ?? 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(c) =>
                              setLineState((prev) => ({
                                ...prev,
                                [item.id]: { selected: c === true },
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
                          {formatInvoiceAmount(unitCents, currency)}
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
          {isPaidInvoice && (
            <div className="space-y-2">
              <Label>How to credit</Label>
              <Select value={destination} onValueChange={(v) => setDestination(v as typeof destination)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATION_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.value === 'refund'
                        ? `${d.label} (maximum ${formatInvoiceAmount(amountToCreditCents, currency)})`
                        : d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
          </div>
        </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || missingStripeIds || amountToCreditCents <= 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Issuing…
              </>
            ) : (
              'Issue credit note'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
