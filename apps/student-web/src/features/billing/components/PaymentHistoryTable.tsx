'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Badge, getInvoiceStatusBadgeVariant } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { useInvoicesWithItems } from '../hooks';
import { formatDateTime } from '@/shared/utils';
import {
  studentBtnOutline,
  studentTableBodyRow,
  studentTableHeaderRow,
  studentTableShell,
} from '@/shared/lib/student-visual';

const formatAmount = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

export function PaymentHistoryTable() {
  const { data: invoices, isLoading, error } = useInvoicesWithItems();

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
        Error loading invoice history: {error.message}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No invoice history yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={studentTableShell}>
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className={studentTableHeaderRow}>
            <TableHead>Invoice Date</TableHead>
            <TableHead>Invoice Number</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice, index) => (
            <TableRow key={invoice.id || `invoice-${index}`} className={studentTableBodyRow}>
              <TableCell>
                {invoice.invoice_date ? formatDateTime(invoice.invoice_date) : '-'}
              </TableCell>
              <TableCell className="font-medium">
                {invoice.stripe_invoice_number || '-'}
              </TableCell>
              <TableCell className="font-medium">
                {invoice.amount_due_cents ? formatAmount(invoice.amount_due_cents) : '-'}
              </TableCell>
              <TableCell>
                {invoice.status ? (
                  <Badge variant={getInvoiceStatusBadgeVariant(invoice.status)}>
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
                      variant="outline"
                      size="sm"
                      className={studentBtnOutline}
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
                      variant="outline"
                      size="sm"
                      className={studentBtnOutline}
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
                      variant="outline"
                      size="sm"
                      className={studentBtnOutline}
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
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

