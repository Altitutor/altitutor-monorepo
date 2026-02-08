'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, DateRangePicker, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useInvoicesList, useInvoiceItems, formatInvoiceDate, getInvoiceStatusBadge, ViewInvoiceModal, invoicesKeys, useInvoiceActions } from '@/features/billing';
import { cn, getErrorMessage } from '@/shared/utils';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { TablePagination } from '@/shared/components/TablePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

interface StudentInvoicesTableProps {
  studentId: string;
}

export function StudentInvoicesTable({ studentId }: StudentInvoicesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [actionInvoiceId, setActionInvoiceId] = useState<string | null>(null);

  // Debounce date values to prevent query from running on every keystroke
  const debouncedFrom = useDebounce(from, 500);
  const debouncedTo = useDebounce(to, 500);

  // Only include complete dates (YYYY-MM-DD format) to prevent API errors with partial dates
  const isCompleteFrom = /^\d{4}-\d{2}-\d{2}$/.test(debouncedFrom);
  const isCompleteTo = /^\d{4}-\d{2}-\d{2}$/.test(debouncedTo);

  // Fetch invoices for this student
  const { 
    data, 
    isLoading, 
    isFetching,
    error 
  } = useInvoicesList({
    studentIds: [studentId],
    from: (debouncedFrom && isCompleteFrom) ? debouncedFrom : undefined,
    to: (debouncedTo && isCompleteTo) ? debouncedTo : undefined,
    page,
    pageSize,
  });

  // Use useMemo to stabilize the invoices array reference
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const total = data?.total || 0;

  // Extract invoice IDs for fetching items
  const invoiceIds = useMemo(() => invoices.map(inv => inv.id), [invoices]);

  // Fetch invoice items for displayed invoices
  const { data: invoiceItemsMap = {} } = useInvoiceItems(invoiceIds);

  const handleSendInvoiceEmail = async (invoiceId: string) => {
    setActionInvoiceId(invoiceId);
    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-invoice`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invoice');
      }

      const result = await response.json();
      const recipients = result.sent || [];
      const recipientText = recipients.length > 0 
        ? `Sent to: ${recipients.join(', ')}`
        : 'Invoice email sent successfully';

      toast({
        title: 'Success',
        description: recipientText,
      });

      // Invalidate invoice queries to refresh data
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to send invoice',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAction(false);
      setActionInvoiceId(null);
    }
  };

  const handleChargeCard = async (invoiceId: string) => {
    setActionInvoiceId(invoiceId);
    setIsLoadingAction(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/charge-card`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to charge card');
      }

      toast({
        title: 'Success',
        description: 'Payment attempt initiated successfully',
      });

      // Invalidate invoice queries to refresh data
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.lists() });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to charge card',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAction(false);
      setActionInvoiceId(null);
    }
  };

  return (
    <>
      {/* Title and Date Range Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invoices</h3>
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={(newFrom) => {
            setFrom(newFrom);
            setPage(1); // Reset to first page when filter changes
          }}
          onToChange={(newTo) => {
            setTo(newTo);
            setPage(1); // Reset to first page when filter changes
          }}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Date</TableHead>
              <TableHead>Invoice Items</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-destructive">
                  Error loading invoices: {error instanceof Error ? error.message : 'Unknown error'}
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No invoices found for this student
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
              const sessionDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
              const items = invoiceItemsMap[invoice.id] || [];
              
              return (
                <TableRow 
                  key={invoice.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setActiveInvoiceId(invoice.id)}
                >
                  <TableCell>
                    <span>{sessionDate ? formatInvoiceDate(sessionDate.toISOString()) : '-'}</span>
                  </TableCell>
                  <TableCell>
                    {items.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {items.slice(0, 2).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <span className={cn(item.is_subsidy && "text-muted-foreground line-through")}>
                                {item.description || 'Invoice item'}
                              </span>
                              {item.is_subsidy && (
                                <Badge variant="outline" className="text-xs">Subsidy</Badge>
                              )}
                            </div>
                            <span className="text-xs font-medium ml-2">
                              ${((item.amount_cents || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {items.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{items.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{`$${((invoice.amount_due_cents || 0)/100).toFixed(2)}`}</TableCell>
                  <TableCell>
                    {getInvoiceStatusBadge(invoice.status)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      // For table rows, we can't use hooks directly, so we use inline logic matching the hook pattern
                      return (
                        <ActionsMenu
                          type="invoice"
                          onOpenInPage={() => {
                            router.push(`/invoices/${invoice.id}`);
                          }}
                          onViewOnStripe={invoice.hosted_invoice_url ? () => {
                            window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
                          } : undefined}
                          onDownloadPdf={invoice.invoice_pdf ? () => {
                            window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
                          } : undefined}
                          onSendInvoice={invoice.collection_method === 'send_invoice' && invoice.status !== 'paid' ? () => handleSendInvoiceEmail(invoice.id) : undefined}
                          onChargeCard={invoice.collection_method === 'charge_automatically' && invoice.status !== 'paid' ? () => handleChargeCard(invoice.id) : undefined}
                          isLoadingAction={isLoadingAction && actionInvoiceId === invoice.id}
                        />
                      );
                    })()}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1); // Reset to first page when page size changes
        }}
      />

      <ViewInvoiceModal
        isOpen={!!activeInvoiceId}
        invoiceId={activeInvoiceId}
        onClose={() => setActiveInvoiceId(null)}
      />
    </>
  );
}
