'use client';

import { useMemo } from 'react';
import { useDataTable } from '@/shared/hooks/useDataTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  DataTableToolbar,
} from '@altitutor/ui';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { useInvoicesWithItems } from '../hooks';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';

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
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'invoice_date', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['date', 'number', 'amount', 'status', 'sessions', 'receipt'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setVisibleColumns,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['status', 'from', 'to'],
  });

  const from = (state.filters.from as string[] | undefined)?.[0] || '';
  const to = (state.filters.to as string[] | undefined)?.[0] || '';
  
  const params = useMemo(() => {
    const isCompleteFrom = /^\d{4}-\d{2}-\d{2}$/.test(from);
    const isCompleteTo = /^\d{4}-\d{2}-\d{2}$/.test(to);
    return { 
      from: (from && isCompleteFrom) ? from : undefined, 
      to: (to && isCompleteTo) ? to : undefined 
    };
  }, [from, to]);
  
  const { data: invoices, isLoading, error } = useInvoicesWithItems(params);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Open', value: 'open' },
        { label: 'Draft', value: 'draft' },
        { label: 'Void', value: 'void' },
        { label: 'Uncollectible', value: 'uncollectible' },
        { label: 'Disputed', value: 'disputed' },
      ],
    },
    { key: 'from', label: 'From date', type: 'date' },
    { key: 'to', label: 'To date', type: 'date' },
  ], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'invoice_date', label: 'Invoice Date' },
    { key: 'amount_due_cents', label: 'Amount' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'date', label: 'Invoice Date' },
    { key: 'number', label: 'Invoice Number' },
    { key: 'amount', label: 'Amount Due' },
    { key: 'status', label: 'Status' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'receipt', label: 'Receipt' },
  ];

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

  const filteredInvoices = useMemo(() => {
    const result = (invoices || []).filter((invoice) => {
      if (state.filters.status?.length > 0 && !state.filters.status.includes(invoice.status as any)) {
        return false;
      }

      if (state.search) {
        const search = state.search.toLowerCase();
        const number = invoice.stripe_invoice_number?.toLowerCase() || '';
        if (!number.includes(search)) return false;
      }

      return true;
    });

    const sorted = [...result];
    if (state.sortBy === 'amount_due_cents') {
      sorted.sort((a, b) => {
        const av = a.amount_due_cents ?? 0;
        const bv = b.amount_due_cents ?? 0;
        return state.sortDirection === 'asc' ? av - bv : bv - av;
      });
    } else {
      sorted.sort((a, b) => {
        const av = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        const bv = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
        return state.sortDirection === 'asc' ? av - bv : bv - av;
      });
    }

    return sorted;
  }, [invoices, state.filters.status, state.search, state.sortBy, state.sortDirection]);

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col gap-2">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          searchPlaceholder="Search invoice numbers..."
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('date') && <TableHead>Invoice Date</TableHead>}
              {state.visibleColumns.includes('number') && <TableHead>Invoice Number</TableHead>}
              {state.visibleColumns.includes('amount') && <TableHead>Amount Due</TableHead>}
              {state.visibleColumns.includes('status') && <TableHead>Status</TableHead>}
              {state.visibleColumns.includes('sessions') && <TableHead>Sessions</TableHead>}
              {state.visibleColumns.includes('receipt') && <TableHead>Receipt</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24 text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice, index) => (
                <TableRow key={invoice.id || `invoice-${index}`}>
                  {state.visibleColumns.includes('date') && (
                    <TableCell>
                      {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('number') && (
                    <TableCell className="font-medium">
                      {invoice.stripe_invoice_number || '-'}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('amount') && (
                    <TableCell className="font-medium">
                      {formatAmount(invoice.amount_due_cents)}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('status') && (
                    <TableCell>
                      {invoice.status ? (
                        <Badge variant={getStatusVariant(invoice.status as InvoiceStatus)}>
                          {invoice.status}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('sessions') && (
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
                  )}
                  {state.visibleColumns.includes('receipt') && (
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
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
