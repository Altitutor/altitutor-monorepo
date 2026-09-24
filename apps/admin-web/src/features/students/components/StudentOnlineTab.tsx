'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  SegmentedControl,
  SegmentedTabPanelContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ExternalLink } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { stripeInvoiceDashboardUrl } from '@/shared/utils/stripe-dashboard-urls';
import { StudentSubscriptionsTable } from './StudentSubscriptionsTable';
import { StudentManualOnlineAccess } from './StudentManualOnlineAccess';

interface StudentOnlineTabProps {
  student: Tables<'students'>;
}

function OnlineInvoices({ studentId }: { studentId: string }) {
  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['online-invoices', studentId],
    queryFn: async () => {
      const { data, error: queryError } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('invoices')
        .select('*')
        .eq('student_id', studentId)
        .eq('billing_source', 'subscription')
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false });
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="py-8 text-center text-muted-foreground">Loading online invoices…</p>;
  if (error) return <p className="py-8 text-center text-destructive">Could not load online invoices.</p>;

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="w-14" /></TableRow></TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No online invoices.</TableCell></TableRow>
          ) : invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">#{invoice.stripe_invoice_number ?? invoice.id.slice(0, 8)}</TableCell>
              <TableCell>{invoice.invoice_date ? new Intl.DateTimeFormat('en-AU').format(new Date(invoice.invoice_date)) : '—'}</TableCell>
              <TableCell>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.amount_due_cents / 100)}</TableCell>
              <TableCell><Badge variant="outline">{invoice.status}</Badge></TableCell>
              <TableCell>
                {invoice.stripe_invoice_id ? (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={stripeInvoiceDashboardUrl(invoice.stripe_invoice_id)} target="_blank" rel="noopener noreferrer" aria-label="Open invoice in Stripe">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StudentOnlineTab({ student }: StudentOnlineTabProps) {
  const [activeTab, setActiveTab] = useState('subscription');
  return (
    <div className="space-y-4">
      <SegmentedControl
        fullWidth
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: 'subscription', label: 'Subscription' },
          { value: 'invoices', label: 'Online invoices' },
          { value: 'manual', label: 'Manual access' },
        ]}
      />
      <SegmentedTabPanelContent when="subscription" activeTab={activeTab}>
        <StudentSubscriptionsTable studentId={student.id} />
      </SegmentedTabPanelContent>
      <SegmentedTabPanelContent when="invoices" activeTab={activeTab}>
        <OnlineInvoices studentId={student.id} />
      </SegmentedTabPanelContent>
      <SegmentedTabPanelContent when="manual" activeTab={activeTab}>
        <StudentManualOnlineAccess student={student} />
      </SegmentedTabPanelContent>
    </div>
  );
}
