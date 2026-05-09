'use client';

import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, TablePagination } from '@altitutor/ui';
import { Loader2, ExternalLink } from 'lucide-react';
import { useInvoicesWithItems } from '../hooks';
import {
  studentBtnOutline,
  studentBtnPrimary,
  studentTableBodyRow,
  studentTableHeaderRow,
  studentTableShell,
} from '@/shared/lib/student-visual';
import { formatAmount, getInvoiceTotalAmount, isInvoiceOverdue } from '../utils/invoiceDisplay';

function getSessionDisplayName(
  items: Array<{
    session?: { long_name: string | null } | null;
    session_id?: string | null;
    subject_name?: string | null;
    description?: string | null;
  }> | undefined
): string {
  const isFeeDescription = (value: string | null | undefined): boolean =>
    (value ?? '').trim().toLowerCase().includes('processing fee');

  const sessionItems = (items ?? []).filter((item) => item.session_id);

  const fromSessionLongName = sessionItems
    .find((item) => item.session?.long_name?.trim())
    ?.session?.long_name?.trim();
  if (fromSessionLongName) {
    return fromSessionLongName;
  }

  // Fallback for environments where nested session relation is not returned.
  // Prefer non-fee description from a real session item.
  const fromSessionDescription = sessionItems
    .find((item) => item.description?.trim() && !isFeeDescription(item.description))
    ?.description?.trim();
  if (fromSessionDescription) {
    return fromSessionDescription;
  }

  // Next best fallback: subject name from a real session item.
  const fromSessionSubjectName = sessionItems.find((item) => item.subject_name?.trim())?.subject_name?.trim();
  if (fromSessionSubjectName) {
    return fromSessionSubjectName;
  }

  const fromDescription = items
    ?.find((item) => {
      const d = item.description?.trim();
      return !!d && !isFeeDescription(d);
    })
    ?.description?.trim();
  return fromDescription || '-';
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

export function InvoicesTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: invoices, isLoading, error } = useInvoicesWithItems();

  const sortedInvoices = useMemo(() => {
    const list = [...(invoices || [])].filter((invoice) => invoice.billing_source !== 'subscription');
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
      <div className={studentTableShell}>
        <Table>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className={studentTableHeaderRow}>
              <TableHead>Session</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInvoices.length === 0 ? (
              <TableRow className={studentTableBodyRow}>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No session invoices found
                </TableCell>
              </TableRow>
            ) : (
              paginatedInvoices.map((invoice, index) => {
                const overdue = isInvoiceOverdue(invoice);
                return (
                  <TableRow key={invoice.id || `invoice-${index}`} className={studentTableBodyRow}>
                  <TableCell>
                    {getSessionDisplayName(invoice.items)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(getInvoiceTotalAmount(invoice))}
                  </TableCell>
                  <TableCell>
                    {invoice.status ? (
                      <div className="flex flex-wrap gap-1">
                        {overdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                        {(invoice.status === 'paid' || invoice.paid_at) && (
                          <Badge variant="default">
                            {invoice.paid_at
                              ? `Paid ${new Date(invoice.paid_at).toLocaleDateString('en-AU')}`
                              : 'Paid'}
                          </Badge>
                        )}
                        {invoice.status === 'draft' && (
                          <Badge variant="outline">Draft</Badge>
                        )}
                        {invoice.status === 'open' && !overdue && (
                          <Badge variant="secondary">Open</Badge>
                        )}
                        {['void', 'uncollectible', 'disputed'].includes(invoice.status) && (
                          <Badge variant="destructive">
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {invoice.hosted_invoice_url &&
                        (invoice.status === 'open' ? (
                          <Button variant="default" size="sm" className={studentBtnPrimary} asChild>
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Pay
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className={studentBtnOutline} asChild>
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        ))}
                      {!invoice.hosted_invoice_url && '-'}
                    </div>
                  </TableCell>
                  </TableRow>
                );
              })
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
