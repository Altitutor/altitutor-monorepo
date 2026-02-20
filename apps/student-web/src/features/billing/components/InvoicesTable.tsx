'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  TablePagination,
} from '@altitutor/ui';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { useInvoicesWithItems } from '../hooks';
import type { InvoiceItem } from '../api';
import { formatInvoiceDate } from '../utils/invoiceFormatters';

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'disputed';

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

function getLineItemDisplayName(item: InvoiceItem): string {
  return item.description?.trim() || item.subject_name || 'Session';
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

export function InvoicesTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: invoices, isLoading, error } = useInvoicesWithItems();

  const sortedInvoices = useMemo(() => {
    const list = [...(invoices || [])];
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

  const totalCount = sortedInvoices.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, pageCount);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPage, pageSize]);

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

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              paginatedInvoices.map((invoice, index) => (
                <TableRow key={invoice.id || `invoice-${index}`}>
                  <TableCell>
                    {invoice.invoice_date ? formatInvoiceDate(invoice.invoice_date) : '-'}
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
                      <div className="text-sm space-y-1">
                        <div className="space-y-0.5">
                          {invoice.items.map((item) => (
                            <div key={item.id ?? item.session_id ?? Math.random()}>
                              {getLineItemDisplayName(item)}
                            </div>
                          ))}
                        </div>
                        {invoice.total_subsidies_cents != null && invoice.total_subsidies_cents > 0 && (
                          <p className="text-muted-foreground text-xs pt-1">
                            Subsidies: {formatAmount(invoice.total_subsidies_cents)}
                          </p>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {invoice.hosted_invoice_url &&
                        (invoice.status === 'paid' ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View invoice
                            </a>
                          </Button>
                        ) : (
                          <Button variant="default" size="sm" asChild>
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Pay invoice
                            </a>
                          </Button>
                        ))}
                      {invoice.invoice_pdf && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download PDF
                          </a>
                        </Button>
                      )}
                      {!invoice.hosted_invoice_url && !invoice.invoice_pdf && '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          total={totalCount}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
    </div>
  );
}
