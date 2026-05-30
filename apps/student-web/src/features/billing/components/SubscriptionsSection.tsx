'use client';

import { useMemo } from 'react';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  PAID_INVOICE_BADGE_VARIANT,
} from '@altitutor/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useInvoicesWithItems, useStudentSubscriptions } from '../hooks';
import { formatAmount, getInvoiceTotalAmount, isInvoiceOverdue } from '../utils/invoiceDisplay';
import { formatInvoiceDate } from '../utils/invoiceFormatters';
import {
  studentBtnOutline,
  studentTableBodyRow,
  studentTableHeaderRow,
  studentTableShell,
} from '@/shared/lib/student-visual';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

function getSubscriptionName(subscription: {
  subject?: { long_name: string | null; short_name: string | null; name: string } | null;
}): string {
  return subscription.subject?.long_name || subscription.subject?.short_name || subscription.subject?.name || 'Subscription';
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU');
}

function getLineItemsDisplay(
  items: Array<{ description?: string | null; subject_name?: string | null; amount_cents?: number | null }> | undefined
): Array<{ label: string; amountCents: number | null }> {
  if (!items?.length) return [];

  return items
    .map((item) => ({
      label: item.description?.trim() || item.subject_name?.trim() || '',
      amountCents: item.amount_cents ?? null,
    }))
    .filter((item) => item.label.length > 0);
}

function inferBillingFrequency(subscription: {
  current_period_start: string | null;
  current_period_end: string | null;
}): string {
  if (!subscription.current_period_start || !subscription.current_period_end) return '-';
  const start = new Date(subscription.current_period_start).getTime();
  const end = new Date(subscription.current_period_end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '-';
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 10) return 'Weekly';
  if (days <= 45) return 'Monthly';
  if (days <= 120) return 'Quarterly';
  if (days <= 220) return 'Biannual';
  return 'Yearly';
}

function getSubscriptionPrice(
  subscriptionId: string,
  invoices: Array<{
    student_subscription_id: string | null;
    items?: Array<{ description?: string | null; amount_cents?: number | null }> | undefined;
    total_charges_cents: number | null;
    total_subsidies_cents: number | null;
    amount_due_cents: number | null;
    invoice_date: string | null;
    created_at: string | null;
  }>
): number | null {
  const related = invoices
    .filter((invoice) => invoice.student_subscription_id === subscriptionId)
    .sort((a, b) => {
      const aTime = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
      const bTime = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated;
    });

  const latest = related[0];
  if (!latest) return null;

  const nonFeeAmount = latest.items?.find((item) => {
    const desc = (item.description ?? '').toLowerCase();
    return !!item.amount_cents && !desc.includes('processing fee');
  })?.amount_cents;
  if (nonFeeAmount != null) return nonFeeAmount;

  return getInvoiceTotalAmount(latest);
}

export function SubscriptionsSection() {
  const { data: subscriptions, isLoading: isSubscriptionsLoading, error: subscriptionsError } = useStudentSubscriptions();
  const { data: invoices, isLoading: isInvoicesLoading, error: invoicesError } = useInvoicesWithItems();

  const subscriptionInvoices = useMemo(() => {
    const list = [...(invoices || [])].filter((invoice) => invoice.billing_source === 'subscription');
    list.sort((a, b) => {
      const aTime = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
      const bTime = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated;
    });
    return list;
  }, [invoices]);

  const sortedSubscriptions = useMemo(() => {
    const list = [...(subscriptions || [])];
    list.sort((a, b) => {
      const aEnd = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
      const bEnd = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
      if (bEnd !== aEnd) return bEnd - aEnd;
      const aUpdated = new Date(a.updated_at).getTime();
      const bUpdated = new Date(b.updated_at).getTime();
      return bUpdated - aUpdated;
    });
    return list;
  }, [subscriptions]);

  if (isSubscriptionsLoading || isInvoicesLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subscriptionsError || invoicesError) {
    return (
      <div className="text-sm text-destructive">
        Failed to load subscription information.
      </div>
    );
  }

  if (!subscriptions?.length && !subscriptionInvoices.length) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Subscriptions</h2>
        <div className={studentTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={studentTableHeaderRow}>
                <TableHead>Subject</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Billing frequency</TableHead>
                <TableHead>Next payment due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSubscriptions.length === 0 ? (
                <TableRow className={studentTableBodyRow}>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No subscriptions found
                  </TableCell>
                </TableRow>
              ) : (
                sortedSubscriptions.map((subscription) => {
                  const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
                  const price = getSubscriptionPrice(subscription.id, subscriptionInvoices);
                  return (
                    <TableRow key={subscription.id} className={studentTableBodyRow}>
                      <TableCell className="font-medium">{getSubscriptionName(subscription)}</TableCell>
                      <TableCell>{formatAmount(price)}</TableCell>
                      <TableCell>{inferBillingFrequency(subscription)}</TableCell>
                      <TableCell>
                        {isActive ? (
                          formatDate(subscription.current_period_end)
                        ) : (
                          <span className="text-muted-foreground">Inactive</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Subscription Invoices</h2>
        <div className={studentTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={studentTableHeaderRow}>
                <TableHead>Date</TableHead>
                <TableHead>Line items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptionInvoices.length === 0 ? (
                <TableRow className={studentTableBodyRow}>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No subscription invoices found
                  </TableCell>
                </TableRow>
              ) : (
                subscriptionInvoices.map((invoice, index) => {
                  const overdue = isInvoiceOverdue(invoice);
                  const lineItems = getLineItemsDisplay(invoice.items);

                  return (
                    <TableRow key={invoice.id || `subscription-invoice-${index}`} className={studentTableBodyRow}>
                      <TableCell>{formatInvoiceDate(invoice.invoice_date)}</TableCell>
                      <TableCell className="max-w-sm">
                        {lineItems.length ? (
                          <div className="space-y-1">
                            {lineItems.map((item, itemIndex) => (
                              <div key={`${invoice.id || index}-line-${itemIndex}`} className="flex items-center gap-2">
                                <span className="truncate min-w-0 flex-1 text-sm">{item.label}</span>
                                <span className="tabular-nums text-xs text-muted-foreground opacity-70 shrink-0">
                                  {formatAmount(item.amountCents)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatAmount(getInvoiceTotalAmount(invoice))}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                          {(invoice.status === 'paid' || invoice.paid_at) && (
                            <Badge variant={PAID_INVOICE_BADGE_VARIANT}>
                              {invoice.paid_at
                                ? `Paid ${new Date(invoice.paid_at).toLocaleDateString('en-AU')}`
                                : 'Paid'}
                            </Badge>
                          )}
                          {invoice.status === 'draft' && <Badge variant="outline">Draft</Badge>}
                          {invoice.status === 'open' && !overdue && <Badge variant="secondary">Open</Badge>}
                          {['void', 'uncollectible', 'disputed'].includes(invoice.status || '') && (
                            <Badge variant="destructive">
                              {(invoice.status || '').charAt(0).toUpperCase() + (invoice.status || '').slice(1)}
                            </Badge>
                          )}
                          {!invoice.status && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.hosted_invoice_url ? (
                          <Button variant="outline" size="sm" className={studentBtnOutline} asChild>
                            <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
