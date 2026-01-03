'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, Download, ExternalLink, X } from 'lucide-react';
import type { Database } from '@altitutor/shared';
import { useInvoicesWithItems } from '../hooks';
import { formatDateTime } from '@/shared/utils';
import { DateRangePicker } from '@/shared/components';

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'disputed';
type Invoice = Database['public']['Views']['vstudent_invoices']['Row'];

const getStatusVariant = (status: InvoiceStatus): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'paid':
      return 'default';
    case 'draft':
    case 'open':
      return 'secondary';
    case 'void':
    case 'uncollectible':
    case 'disputed':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const formatAmount = (cents: number | null): string => {
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

export function InvoicesTable() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  
  const { data: invoices, isLoading, error } = useInvoicesWithItems({
    from: from || undefined,
    to: to || undefined,
  });

  const hasActiveFilters = from || to;

  const clearFilters = () => {
    setFrom('');
    setTo('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading invoices: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-end gap-2">
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!invoices || invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice, index) => (
                <TableRow key={invoice.id || `invoice-${index}`}>
                  <TableCell>
                    {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.stripe_invoice_number || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(invoice.amount_due_cents)}
                  </TableCell>
                  <TableCell>
                    {invoice.status ? (
                      <Badge variant={getStatusVariant(invoice.status as InvoiceStatus)}>
                        {invoice.status}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {invoice.items && invoice.items.length > 0 ? (
                      <div className="text-sm">
                        <p className="font-medium">{invoice.items.length} session{invoice.items.length !== 1 ? 's' : ''}</p>
                        {invoice.total_subsidies_cents && invoice.total_subsidies_cents > 0 && (
                          <p className="text-muted-foreground text-xs">
                            Subsidies: {formatAmount(invoice.total_subsidies_cents)}
                          </p>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {invoice.receipt_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={invoice.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Receipt
                          </a>
                        </Button>
                      )}
                      {invoice.hosted_invoice_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={invoice.hosted_invoice_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        </Button>
                      )}
                      {invoice.invoice_pdf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={invoice.invoice_pdf} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      )}
                      {!invoice.receipt_url && !invoice.hosted_invoice_url && !invoice.invoice_pdf && '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
