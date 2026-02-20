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
  DataTableToolbar,
  useToast,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import {
  useInvoicesList,
  useInvoiceItems,
  formatInvoiceDate,
  formatInvoiceTagText,
  getInvoiceStatusBadge,
  ViewInvoiceModal,
  invoicesKeys,
} from '@/features/billing';
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared';
import type { InvoiceRow } from '@/features/billing/api/billing';
import { cn, getErrorMessage } from '@/shared/utils';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { TablePagination } from '@/shared/components/TablePagination';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';

interface StudentInvoicesTableProps {
  studentId: string;
}

const INVOICE_STATUSES: InvoiceRow['status'][] = ['draft', 'open', 'paid', 'void', 'uncollectible', 'disputed'];

export function StudentInvoicesTable({ studentId }: StudentInvoicesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('invoices');

  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [actionInvoiceId, setActionInvoiceId] = useState<string | null>(null);

  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'invoice_date', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['date', 'items', 'amount', 'status', 'actions'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    pageSize: 20,
    skipUrlSync: true,
    filterKeys: ['status', 'from', 'to'],
  });

  const from = (state.filters.from as string[] | undefined)?.[0];
  const to = (state.filters.to as string[] | undefined)?.[0];
  const isCompleteFrom = !!from && /^\d{4}-\d{2}-\d{2}$/.test(from);
  const isCompleteTo = !!to && /^\d{4}-\d{2}-\d{2}$/.test(to);

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useInvoicesList({
    studentIds: [studentId],
    statuses: (state.filters.status as InvoiceRow['status'][]) || [],
    from: isCompleteFrom ? from : undefined,
    to: isCompleteTo ? to : undefined,
    page: state.page,
    pageSize: state.pageSize,
    orderBy: (state.sortBy as 'invoice_date' | 'created_at' | 'status' | 'amount_due_cents') || 'invoice_date',
    ascending: state.sortDirection === 'asc',
  });

  const invoices = useMemo(() => {
    const rows = data?.invoices || [];
    if (!state.search.trim()) return rows;

    const q = state.search.toLowerCase();
    return rows.filter((invoice) => {
      const invoiceNumber = (invoice.stripe_invoice_number || '').toLowerCase();
      return invoiceNumber.includes(q);
    });
  }, [data?.invoices, state.search]);

  const total = data?.total || 0;
  const invoiceIds = useMemo(() => invoices.map((inv) => inv.id), [invoices]);
  const { data: invoiceItemsMap = {} } = useInvoiceItems(invoiceIds);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: INVOICE_STATUSES.map((status) => ({
        value: status,
        label: status.charAt(0).toUpperCase() + status.slice(1),
      })),
    },
    { key: 'from', label: 'From date', type: 'date' },
    { key: 'to', label: 'To date', type: 'date' },
  ], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'invoice_date', label: 'Session Date' },
    { key: 'created_at', label: 'Created At' },
    { key: 'status', label: 'Status' },
    { key: 'amount_due_cents', label: 'Amount Due' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'date', label: 'Session Date' },
    { key: 'items', label: 'Invoice Items' },
    { key: 'amount', label: 'Amount Due' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invoices</h3>
      </div>

      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters}
        searchPlaceholder="Search invoice numbers..."
        isLoading={isFetching}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('date') && <TableHead>Session Date</TableHead>}
              {state.visibleColumns.includes('items') && <TableHead>Invoice Items</TableHead>}
              {state.visibleColumns.includes('amount') && <TableHead>Amount Due</TableHead>}
              {state.visibleColumns.includes('status') && <TableHead>Status</TableHead>}
              {state.visibleColumns.includes('actions') && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24 text-destructive">
                  Error loading invoices: {error instanceof Error ? error.message : 'Unknown error'}
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24 text-muted-foreground">
                  No invoices found for this student
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
                const sessionDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
                const items = invoiceItemsMap[invoice.id] || [];
                const invoiceTagText = formatInvoiceTagText({
                  invoiceDate: invoice.invoice_date,
                  lineItemDescriptions: items.map((item) => item.description || 'Invoice item'),
                  status: invoice.status,
                });

                return (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setActiveInvoiceId(invoice.id)}
                  >
                    {state.visibleColumns.includes('date') && (
                      <TableCell>
                        <span>{sessionDate ? formatInvoiceDate(sessionDate.toISOString()) : '-'}</span>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('items') && (
                      <TableCell>
                        {items.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {items.slice(0, 2).map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                  <span className={cn(item.is_subsidy && 'text-muted-foreground line-through')}>
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
                    )}
                    {state.visibleColumns.includes('amount') && (
                      <TableCell>{`$${((invoice.amount_due_cents || 0) / 100).toFixed(2)}`}</TableCell>
                    )}
                    {state.visibleColumns.includes('status') && (
                      <TableCell>{getInvoiceStatusBadge(invoice.status, invoice.is_refunded)}</TableCell>
                    )}
                    {state.visibleColumns.includes('actions') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionsMenu
                          type="invoice"
                          entityId={invoice.id}
                          copyTagDisplayText={invoiceTagText}
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
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ViewInvoiceModal
        isOpen={!!activeInvoiceId}
        invoiceId={activeInvoiceId}
        onClose={() => setActiveInvoiceId(null)}
      />
    </>
  );
}
