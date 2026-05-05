'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  useToast,
} from '@altitutor/ui';
import { RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { format } from 'date-fns';
import {
  fetchStudentSubscriptions,
  studentSubscriptionsKeys,
} from '@/features/students/api/subscriptions';
import { getErrorMessage } from '@/shared/utils';
import { stripeSubscriptionDashboardUrl } from '@/shared/utils/stripe-dashboard-urls';

function subjectLabel(subject: {
  long_name: string | null;
  short_name: string | null;
  name: string;
} | null): string {
  if (!subject) return '—';
  return subject.long_name || subject.short_name || subject.name;
}

function formatPeriod(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy, h:mm a');
  } catch {
    return iso;
  }
}

function subscriptionStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'trialing') return 'default';
  if (s === 'past_due' || s === 'unpaid') return 'destructive';
  if (s === 'canceled' || s === 'cancelled' || s === 'incomplete_expired') return 'secondary';
  return 'outline';
}

interface StudentSubscriptionsTableProps {
  studentId: string;
}

export function StudentSubscriptionsTable({ studentId }: StudentSubscriptionsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: studentSubscriptionsKeys.student(studentId),
    queryFn: () => fetchStudentSubscriptions(studentId),
  });

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {getErrorMessage(error)}
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading subscriptions…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground max-w-xl">
          Stripe is the source of truth for billing. Rows sync from webhooks. Use Stripe Dashboard
          to cancel or change plans; set{' '}
          <code className="text-xs">NEXT_PUBLIC_STRIPE_DASHBOARD_TEST_MODE=true</code> in admin-web
          for test-mode dashboard links.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: studentSubscriptionsKeys.student(studentId),
            });
            void refetch();
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          No subscription records for this student. They may subscribe via the UCAT app checkout
          (creates a row when checkout completes).
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current period</TableHead>
                <TableHead>Stripe subscription</TableHead>
                <TableHead>Price / product</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{subjectLabel(row.subject)}</TableCell>
                  <TableCell>
                    <Badge variant={subscriptionStatusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatPeriod(row.current_period_start)}
                    <span className="mx-1">→</span>
                    {formatPeriod(row.current_period_end)}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs break-all">{row.stripe_subscription_id}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="space-y-1">
                      {row.stripe_price_id ? (
                        <div>
                          <span className="text-muted-foreground">Price: </span>
                          <code className="break-all">{row.stripe_price_id}</code>
                        </div>
                      ) : null}
                      {row.stripe_product_id ? (
                        <div>
                          <span className="text-muted-foreground">Product: </span>
                          <code className="break-all">{row.stripe_product_id}</code>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Copy subscription ID"
                        onClick={() => void copyText('Subscription ID', row.stripe_subscription_id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <a
                          href={stripeSubscriptionDashboardUrl(row.stripe_subscription_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Stripe
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
