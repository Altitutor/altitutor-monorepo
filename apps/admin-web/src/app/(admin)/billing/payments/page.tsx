'use client';

import { useEffect, useMemo, useState } from 'react';
import { billingApi, type InvoiceRow } from '@/features/billing';
import { TestBillingRunner } from '@/features/billing/components/TestBillingRunner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@altitutor/ui';
import { ExternalLink, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function PaymentsPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [_loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'ALL' | InvoiceRow['status']>('ALL');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await billingApi.listInvoices({ status, q, from, to });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search invoice/charge ID" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
              <SelectItem value="uncollectible">Uncollectible</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <Button onClick={load}>Refresh</Button>
        </div>
      </div>

      <TestBillingRunner />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Charge ID</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '-'}</TableCell>
                <TableCell className="font-mono text-xs">{invoice.stripe_invoice_number || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{invoice.student_id}</TableCell>
                <TableCell>{`$${((invoice.amount_due_cents || 0)/100).toFixed(2)} ${invoice.currency || 'AUD'}`}</TableCell>
                <TableCell>{`$${((invoice.amount_paid_cents || 0)/100).toFixed(2)}`}</TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell className="font-mono text-xs">{invoice.stripe_charge_id || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {invoice.hosted_invoice_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {invoice.invoice_pdf && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


