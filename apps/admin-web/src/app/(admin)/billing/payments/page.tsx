'use client';

import { useEffect, useMemo, useState } from 'react';
import { billingApi, type InvoiceRow, type InvoiceItemRow } from '@/features/billing';
import { TestBillingRunner } from '@/features/billing/components/TestBillingRunner';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button, Badge } from '@altitutor/ui';
import { ExternalLink, Download, CalendarIcon } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { cn } from '@/shared/utils';

export const dynamic = 'force-dynamic';

type InvoiceWithStudent = InvoiceRow & { 
  student?: { id: string; first_name: string; last_name: string } | null;
  items?: InvoiceItemRow[];
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<InvoiceWithStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'ALL' | InvoiceRow['status']>('ALL');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await billingApi.listInvoices({ status, q, from, to });
      // Fetch invoice items for each invoice
      const invoicesWithItems = await Promise.all(
        data.map(async (invoice) => {
          const items = await billingApi.getInvoiceItemsByInvoice(invoice.id);
          return { ...invoice, items };
        })
      );
      setRows(invoicesWithItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, from, to]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => rows, [rows]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    let label = status;

    switch (status) {
      case 'paid':
        variant = 'default';
        label = 'Paid';
        break;
      case 'draft':
        variant = 'outline';
        label = 'Draft';
        break;
      case 'open':
        variant = 'secondary';
        label = 'Open';
        break;
      case 'void':
      case 'uncollectible':
      case 'disputed':
        variant = 'destructive';
        label = status.charAt(0).toUpperCase() + status.slice(1);
        break;
      default:
        variant = 'outline';
    }

    return <Badge variant={variant} className="text-xs">{label}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search invoice/student name" value={q} onChange={e => setQ(e.target.value)} />
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
              <TableHead>Session Date</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Invoice Items</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => {
                const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
                const sessionDate = invoiceDate ? addDays(invoiceDate, 1) : null;
                
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{invoiceDate ? formatDate(invoice.invoice_date!) : '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sessionDate ? formatDate(sessionDate.toISOString()) : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{invoice.stripe_invoice_number || '-'}</TableCell>
                    <TableCell>
                      {invoice.student ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveStudentId(invoice.student!.id);
                          }}
                        >
                          {invoice.student.first_name} {invoice.student.last_name}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {invoice.items && invoice.items.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {invoice.items.map((item) => (
                            <div key={item.id} className="text-xs">
                              <span className={cn(item.is_subsidy && "text-muted-foreground line-through")}>
                                {item.description || 'Invoice item'}
                              </span>
                              {item.is_subsidy && (
                                <Badge variant="outline" className="text-xs ml-1">Subsidy</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{`$${((invoice.amount_due_cents || 0)/100).toFixed(2)} ${invoice.currency || 'AUD'}`}</TableCell>
                    <TableCell>{`$${((invoice.amount_paid_cents || 0)/100).toFixed(2)}`}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ViewStudentModal
        isOpen={!!activeStudentId}
        studentId={activeStudentId}
        onClose={() => setActiveStudentId(null)}
        onStudentUpdated={() => {}}
      />
    </div>
  );
}


