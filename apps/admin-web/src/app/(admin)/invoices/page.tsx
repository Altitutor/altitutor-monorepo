'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type InvoiceRow,
  ViewInvoiceModal,
  useInvoicesList,
  useInvoiceItems,
  formatInvoiceDate,
  formatInvoiceTagText,
  getInvoiceStatusBadge,
} from '@/features/billing';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  DataTableToolbar,
} from '@altitutor/ui';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { cn } from '@/shared/utils';
import { TablePagination } from '@/shared/components/TablePagination';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';
import { useStudentSearchForFilter } from '@/features/sessions/hooks/useStudentSearchForFilter';

export const dynamic = 'force-dynamic';

const INVOICE_STATUSES: InvoiceRow['status'][] = ['draft', 'open', 'paid', 'void', 'uncollectible', 'disputed'];

export default function InvoicesPage() {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('invoices');
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [studentFilterSearch, setStudentFilterSearch] = useState('');

  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'invoice_date', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['date', 'student', 'items', 'amount', 'status', 'actions'], []);

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
    pageSize: 50,
    filterKeys: ['status', 'student', 'from', 'to'],
  });

  const from = (state.filters.from as string[] | undefined)?.[0];
  const to = (state.filters.to as string[] | undefined)?.[0];
  const isCompleteFrom = !!from && /^\d{4}-\d{2}-\d{2}$/.test(from);
  const isCompleteTo = !!to && /^\d{4}-\d{2}-\d{2}$/.test(to);

  const { data: studentSearchData } = useStudentSearchForFilter(studentFilterSearch, ['ACTIVE', 'TRIAL']);

  const { data, isLoading, isFetching, error } = useInvoicesList({
    statuses: (state.filters.status as InvoiceRow['status'][]) || [],
    studentIds: (state.filters.student as string[]) || [],
    from: isCompleteFrom ? from : undefined,
    to: isCompleteTo ? to : undefined,
    page: state.page,
    pageSize: state.pageSize,
    orderBy: (state.sortBy as 'invoice_date' | 'created_at' | 'status' | 'amount_due_cents') || 'invoice_date',
    ascending: state.sortDirection === 'asc',
  });

  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
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
    {
      key: 'student',
      label: 'Student',
      options: (studentSearchData?.students || []).map((student) => ({
        value: student.id,
        label: `${student.first_name} ${student.last_name}`,
      })),
      searchable: true,
      searchPlaceholder: 'Search students...',
    },
    { key: 'from', label: 'From date', type: 'date' },
    { key: 'to', label: 'To date', type: 'date' },
  ], [studentSearchData?.students]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'invoice_date', label: 'Session Date' },
    { key: 'created_at', label: 'Created At' },
    { key: 'status', label: 'Status' },
    { key: 'amount_due_cents', label: 'Amount Due' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'date', label: 'Session Date' },
    { key: 'student', label: 'Student' },
    { key: 'items', label: 'Invoice Items' },
    { key: 'amount', label: 'Amount Due' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
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
        filterSearchValues={{ student: studentFilterSearch }}
        onFilterSearchChange={(filterKey, value) => {
          if (filterKey === 'student') setStudentFilterSearch(value);
        }}
        searchPlaceholder="Search invoices..."
        isLoading={isFetching}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('date') && <TableHead>Session Date</TableHead>}
              {state.visibleColumns.includes('student') && <TableHead>Student</TableHead>}
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
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24 text-destructive">
                  Error loading invoices. Please try again.
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24">
                  No invoices found
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
                    {state.visibleColumns.includes('student') && (
                      <TableCell>
                        {invoice.student ? (
                          <span className="text-sm">
                            {invoice.student.first_name} {invoice.student.last_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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
                              <div className="text-xs text-muted-foreground">+{items.length - 2} more</div>
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
                      <TableCell>
                        {getInvoiceStatusBadge({
                          status: invoice.status,
                          paid_at: invoice.paid_at,
                          refunded_at: invoice.refunded_at,
                          has_credit_notes: invoice.has_credit_notes,
                          is_refunded: invoice.is_refunded,
                        })}
                      </TableCell>
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
    </div>
  );
}
