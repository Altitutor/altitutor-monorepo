'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EntityChip, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  DataTableToolbar, TablePagination, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { MoreVertical } from 'lucide-react';
import { billingChargesQuery, estimateBillingCharges, loadAdjustmentPeopleAndSessions, type BillingCharge } from '../api/workQueues';
import { useSessionBillingAdjustmentIssues } from '@/features/reconciliation/api/queries';
import { useInvoiceSessionMutation } from '@/features/sessions/hooks/useInvoiceSessionMutation';
import { describeBillingAdjustment } from '../utils/sessionBillingIssue';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useAdminUrlSync } from '@/shared/hooks/useAdminUrlSync';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';
import { formatCurrency } from '@/shared/utils/pricing';
import { DeleteVoidInvoiceButton } from './DeleteVoidInvoiceButton';

const columns = [
  { key: 'student', label: 'Student' }, { key: 'session', label: 'Session' }, { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' }, { key: 'issue', label: 'Billing issue' },
];
const defaultColumns = columns.map((column) => column.key);
const defaultSort = { field: 'date', direction: 'asc' as const };
const defaultFilters = {};
type WorkRow = { id: string; studentId: string; studentName: string; sessionId: string; sessionName: string;
  date: string; label: string; guidance: string; details?: string; amountCents?: number | null; currency?: string; charge?: BillingCharge };

export function BillingWorkTable({ mode }: { mode: 'charges' | 'adjustments' }) {
  useAdminUrlSync();
  const { data: staff } = useCurrentStaff();
  const navigation = useEntityNavigation();
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const invoice = useInvoiceSessionMutation();
  const table = useDataTable({ defaultFilters, defaultSort, defaultVisibleColumns: defaultColumns, filterKeys: ['reason', 'status', 'student', 'from', 'to'], pageSize: 50 });
  const { state } = table;
  const entity = mode === 'charges' ? 'billing-charges' : 'billing-adjustments';
  const { data: views = [] } = useQuickFilters(entity);
  const charges = useQuery({ ...billingChargesQuery, enabled: mode === 'charges' });
  const adjustments = useSessionBillingAdjustmentIssues(mode === 'adjustments');
  const adjustmentIds = [...new Set((adjustments.data ?? []).map((row) => row.adjustment_id))];
  const labels = useQuery({
    queryKey: ['billing-work-labels', adjustmentIds],
    queryFn: () => loadAdjustmentPeopleAndSessions(
      [...new Set((adjustments.data ?? []).map((row) => row.student_id))],
      [...new Set((adjustments.data ?? []).map((row) => row.session_id))]),
    enabled: mode === 'adjustments' && !!adjustmentIds.length,
  });
  const rows = useMemo<WorkRow[]>(() => mode === 'charges'
    ? (charges.data ?? []).filter((row) => !state.filters.reason?.length || state.filters.reason.includes(row.reason)).map((row) => ({
      id: row.sessions_students_id, studentId: row.student_id, studentName: [row.student_first_name, row.student_last_name].filter(Boolean).join(' ') || 'Student',
      sessionId: row.session_id, sessionName: row.session_short_name || row.session_name, date: row.session_start_at,
      label: row.reason === 'voided' ? 'Previous invoice voided' : 'Not invoiced',
      guidance: row.reason === 'voided' ? 'Review why the previous invoice was voided. If the charge is still owed, remove that voided invoice before invoicing again.' : 'Use Invoice session in the row actions.',
      charge: row,
    }))
    : (adjustments.data ?? []).filter((row) => !state.filters.status?.length || state.filters.status.includes(row.status)).map((row) => ({
      studentId: row.student_id, studentName: labels.data?.students[row.student_id] || 'Student',
      sessionId: row.session_id, sessionName: labels.data?.sessions[row.session_id] || 'Session', date: row.session_start_at || row.created_at,
      ...describeBillingAdjustment(row), amountCents: row.amount_cents, currency: row.currency,
    })), [mode, charges.data, adjustments.data, labels.data, state.filters]);
  const filtered = useMemo(() => {
    const query = state.search.trim().toLocaleLowerCase();
    const result = rows.filter((row) => {
      const date = new Date(row.date).toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
      return (!query || [row.studentName, row.sessionName, row.label].some((value) => value.toLocaleLowerCase().includes(query)))
        && (!state.filters.student?.length || state.filters.student.includes(row.studentId))
        && (!state.filters.from?.[0] || date >= String(state.filters.from[0]))
        && (!state.filters.to?.[0] || date <= String(state.filters.to[0]));
    });
    result.sort((a, b) => {
      const key = state.sortBy;
      const order = key === 'student' ? a.studentName.localeCompare(b.studentName) : key === 'date' ? a.date.localeCompare(b.date) : 0;
      return order * (state.sortDirection === 'asc' ? 1 : -1) || a.id.localeCompare(b.id);
    });
    return result;
  }, [rows, state.search, state.sortBy, state.sortDirection, state.filters]);
  const page = Math.min(state.page, Math.max(1, Math.ceil(filtered.length / state.pageSize)));
  const visible = filtered.slice((page - 1) * state.pageSize, page * state.pageSize);
  const estimateRows = visible.flatMap((row) => row.charge ? [row.charge] : []);
  const estimates = useQuery({
    queryKey: ['billing-charge-estimates', estimateRows],
    queryFn: () => estimateBillingCharges(estimateRows), enabled: mode === 'charges' && !!estimateRows.length,
    staleTime: 30_000,
  });
  const source = mode === 'charges' ? charges : adjustments;
  const error = source.error || (mode === 'adjustments' ? labels.error : null);
  return <div className="space-y-4">
    <DataTableToolbar state={state} onSearchChange={table.setSearch} onFiltersChange={table.setFilters} onSortChange={table.setSort}
      onGroupByChange={() => {}} onVisibleColumnsChange={table.setVisibleColumns} onQuickFilterApply={(view) => table.applyQuickFilter(view, staff?.id)}
      onReset={table.resetFilters} quickFilters={views} viewTarget={entity}
      filterDefinitions={[
        { key: 'student', label: 'Student', options: [...new Map(rows.map((row) => [row.studentId, { value: row.studentId, label: row.studentName }])).values()] },
        { key: 'date', label: 'Session date', type: 'date-range', fromKey: 'from', toKey: 'to' },
        ...(mode === 'charges' ? [{ key: 'reason', label: 'Reason', options: [{ value: 'uninvoiced', label: 'Not invoiced' }, { value: 'voided', label: 'Previous invoice voided' }] }]
        : [{ key: 'status', label: 'Processing state', options: [{ value: 'failed', label: 'Needs review' }, { value: 'retryable', label: 'Retry scheduled' }, { value: 'pending', label: 'Waiting' }, { value: 'processing', label: 'Processing delayed' }] }])]}
      sortOptions={[{ key: 'date', label: 'Session date' }, { key: 'student', label: 'Student' }]}
      columnDefinitions={columns.map((column) => column.key === 'amount' && mode === 'charges' ? { ...column, label: 'Estimated charge' } : column)}
      searchPlaceholder="Search students, sessions, or billing issues…" isLoading={source.isFetching} />
    {mode === 'charges' && <p className="text-xs text-muted-foreground">Estimated charges include session pricing and subsidies. Customer account credits and balances are applied when invoicing.</p>}
    {error ? <div role="alert" className="text-sm text-destructive">Could not load billing work. <Button variant="link" onClick={() => { void source.refetch(); void labels.refetch(); }}>Retry</Button></div> :
      <div className="rounded-md border"><Table><TableHeader><TableRow>
        {columns.filter((column) => state.visibleColumns.includes(column.key)).map((column) => <TableHead key={column.key}>{column.key === 'amount' && mode === 'charges' ? 'Estimated charge' : column.label}</TableHead>)}
        <TableHead><span className="sr-only">Actions</span></TableHead>
      </TableRow></TableHeader><TableBody>
        {source.isLoading ? <TableRow><TableCell colSpan={state.visibleColumns.length + 1}>Loading billing work…</TableCell></TableRow> :
          !visible.length ? <TableRow><TableCell colSpan={state.visibleColumns.length + 1}>No {mode === 'charges' ? 'charges to invoice' : 'adjustments needing attention'}{state.search || Object.keys(state.filters).length ? ' match this view' : ''}.</TableCell></TableRow> :
          visible.map((row) => {
            const amount = row.charge ? estimates.data?.[row.id] : row.amountCents != null ? { amountCents: row.amountCents, currency: row.currency || 'aud' } : undefined;
            const voidId = row.charge && 'void_invoice_id' in row.charge ? row.charge.void_invoice_id : undefined;
            return <TableRow key={row.id}>
              {state.visibleColumns.includes('student') && <TableCell><EntityChip entityType="student" entityId={row.studentId} label={row.studentName} onClick={() => navigation.openStudent(row.studentId)} /></TableCell>}
              {state.visibleColumns.includes('session') && <TableCell><EntityChip entityType="session" entityId={row.sessionId} label={row.sessionName} onClick={() => navigation.openSession(row.sessionId)} /></TableCell>}
              {state.visibleColumns.includes('date') && <TableCell className="whitespace-nowrap">{new Date(row.date).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium', timeStyle: 'short' })}</TableCell>}
              {state.visibleColumns.includes('amount') && <TableCell>{amount ? formatCurrency(amount.amountCents, amount.currency) : estimates.isLoading && row.charge ? 'Loading…' : row.charge ? 'Estimate unavailable' : 'Calculated during processing'}</TableCell>}
              {state.visibleColumns.includes('issue') && <TableCell className="max-w-96 whitespace-normal"><div className="font-medium">{row.label}</div><p className="text-xs text-muted-foreground">{row.guidance}</p>
                {row.details && <details><summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary><p className="whitespace-pre-wrap break-words text-xs">{row.details}</p></details>}</TableCell>}
              <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Billing actions"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {row.charge?.reason === 'uninvoiced' && <DropdownMenuItem disabled={invoice.isPending} onSelect={() => invoice.mutate(row.id)}>Invoice session</DropdownMenuItem>}
                  {voidId && <><DropdownMenuItem onSelect={() => navigation.openInvoice(voidId)}>Open voided invoice</DropdownMenuItem><DropdownMenuItem onSelect={() => setDeleteInvoiceId(voidId)}>Delete voided invoice…</DropdownMenuItem></>}
                  <DropdownMenuItem onSelect={() => navigation.openStudent(row.studentId)}>Open student</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigation.openSession(row.sessionId)}>Open session</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu></TableCell>
            </TableRow>;
          })}
      </TableBody></Table></div>}
    <TablePagination page={page} pageSize={state.pageSize} total={filtered.length} onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
      countSummary={`${filtered.length} ${mode === 'charges' ? 'charges' : 'adjustments'}`} />
    {deleteInvoiceId && <DeleteVoidInvoiceButton invoiceId={deleteInvoiceId} open hideTrigger onOpenChange={(open) => { if (!open) setDeleteInvoiceId(null); }} />}
  </div>;
}
