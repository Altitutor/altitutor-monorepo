"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DataTableToolbar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@altitutor/ui';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { listDeletedBusinessRecords, restoreBusinessRecord, type DeletedBusinessRecord } from './api';

const COLUMNS = ['type', 'name'];
const FILTERS = ['kind'];
const LABELS: Record<string, string> = {
  student: 'Student', staff: 'Staff', parent: 'Parent', class: 'Class', subject: 'Subject', topic: 'Topic',
  task: 'Task', project: 'Project', issue: 'Issue', document: 'Document', folder: 'Document folder', admin_shift: 'Admin shift',
  invoice: 'Invoice', file: 'File', form_response: 'Form response', flashcard: 'Flashcard', question_stem: 'Question stem',
  question_set: 'Question set', mock: 'Mock exam', learning_module: 'Learning module', ucat_question: 'UCAT question', skill_trainer_item: 'Skill trainer item',
};

export function DeletedRecordsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['deleted-business-records'], queryFn: listDeletedBusinessRecords });
  const [selected, setSelected] = useState<DeletedBusinessRecord | null>(null);
  const { state, setSearch, setFilters, setSort, setVisibleColumns, setPage, setPageSize, resetFilters } = useDataTable({
    defaultVisibleColumns: COLUMNS, filterKeys: FILTERS, defaultSort: { field: 'deleted_at', direction: 'desc' }, pageSize: 20,
  });
  const restore = useMutation({
    mutationFn: restoreBusinessRecord,
    onSuccess: async () => { setSelected(null); await client.invalidateQueries(); },
  });
  const rows = (query.data ?? []).filter(row =>
    (!state.filters.kind?.length || state.filters.kind.includes(row.kind)) &&
    `${LABELS[row.kind] ?? row.kind} ${row.name}`.toLowerCase().includes(state.search.toLowerCase())
  ).sort((a, b) => {
    const field = state.sortBy;
    const left = field === 'name' ? a.name : field === 'type' ? LABELS[a.kind] ?? a.kind : a.deleted_at;
    const right = field === 'name' ? b.name : field === 'type' ? LABELS[b.kind] ?? b.kind : b.deleted_at;
    return left.localeCompare(right) * (state.sortDirection === 'asc' ? 1 : -1);
  });
  const page = Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.pageSize)));
  const visible = rows.slice((page - 1) * state.pageSize, page * state.pageSize);
  return <div className="space-y-4 p-6">
    <DataTableToolbar state={state} onSearchChange={setSearch} onFiltersChange={setFilters} onSortChange={setSort}
      onGroupByChange={() => {}} onVisibleColumnsChange={setVisibleColumns} onQuickFilterApply={() => {}} onReset={resetFilters}
      filterDefinitions={[{ key: 'kind', label: 'Type', options: Object.entries(LABELS).map(([value, label]) => ({ value, label })) }]}
      sortOptions={[{ key: 'name', label: 'Entity name' }, { key: 'type', label: 'Type' }, { key: 'deleted_at', label: 'Deleted date' }]}
      columnDefinitions={[{ key: 'type', label: 'Type', visibleByDefault: true }, { key: 'name', label: 'Entity name', visibleByDefault: true }, { key: 'deleted_at', label: 'Deleted', visibleByDefault: false }]}
      defaultVisibleColumns={COLUMNS} searchPlaceholder="Search deleted entities…" hideViews isLoading={query.isLoading} />
    {query.isError ? <p role="alert">Unable to load deleted entities. <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></p> : <>
      <Table><TableHeader><TableRow>
        {state.visibleColumns.includes('type') && <TableHead>Type</TableHead>}
        {state.visibleColumns.includes('name') && <TableHead>Entity name</TableHead>}
        {state.visibleColumns.includes('deleted_at') && <TableHead>Deleted</TableHead>}
      </TableRow></TableHeader><TableBody>
        {visible.map(row => <TableRow key={`${row.kind}:${row.id}`}>
          {state.visibleColumns.includes('type') && <TableCell>{LABELS[row.kind] ?? row.kind}</TableCell>}
          {state.visibleColumns.includes('name') && <TableCell><button className="text-left font-medium hover:underline" onClick={() => { restore.reset(); setSelected(row); }}>{row.name}</button></TableCell>}
          {state.visibleColumns.includes('deleted_at') && <TableCell>{new Date(row.deleted_at).toLocaleString()}</TableCell>}
        </TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={state.visibleColumns.length || 1}>{query.isLoading ? 'Loading…' : 'No deleted entities match your filters.'}</TableCell></TableRow>}
      </TableBody></Table>
      <TablePagination page={page} pageSize={state.pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>}
    <AdminDialogShell open={!!selected} onClose={() => { if (!restore.isPending) setSelected(null); }} title={selected?.name ?? 'Deleted entity'}
      footer={selected?.can_restore ? <Button disabled={restore.isPending} onClick={() => restore.mutate(selected)}>{restore.isPending ? 'Restoring…' : 'Restore entity'}</Button> : undefined}>
      {selected && <div className="space-y-3 text-sm">
        <p>{LABELS[selected.kind] ?? selected.kind} · Deleted {new Date(selected.deleted_at).toLocaleString()}</p>
        <p>History and links are retained. Restoring does not reclaim released contact details, restart services, or reactivate Staff access.</p>
        {!selected.can_restore && <p>This entity uses its existing content or financial recovery workflow. It cannot be restored from this directory.</p>}
        {restore.isError && <p role="alert">{restore.error instanceof Error ? restore.error.message : 'Unable to restore this entity. Resolve its parent records or active editors first.'}</p>}
      </div>}
    </AdminDialogShell>
  </div>;
}
