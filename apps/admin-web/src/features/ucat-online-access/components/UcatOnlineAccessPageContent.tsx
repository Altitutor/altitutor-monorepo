'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
  SkeletonTable,
  DataTableToolbar,
  TablePagination,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialog,
} from '@altitutor/ui';
import { Plus, Trash2, Loader2, ArrowUpDown, Shield } from 'lucide-react';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import {
  manualOnlineAccessApi,
  UCAT_TIER_OVERRIDE_LABELS,
} from '@/features/ucat-online-access/api/ucat-online-access';
import { AddUcatOnlineAccessModal } from './AddUcatOnlineAccessModal';
import { SetUcatTierOverrideModal } from './SetUcatTierOverrideModal';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useCurrentStaff } from '@/shared/hooks';
import { useStudentSearchForFilter } from '@/features/sessions/hooks/useStudentSearchForFilter';
import { useSubjectsSearchForFilter } from '@/features/classes/hooks/useSubjectsSearchForFilter';
import { useManualOnlineAccessTable } from '../hooks/useManualOnlineAccessTable';

export function UcatOnlineAccessPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const [addOpen, setAddOpen] = useState(false);
  const [tierOverrideOpen, setTierOverrideOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [studentFilterSearch, setStudentFilterSearch] = useState('');
  const [subjectFilterSearch, setSubjectFilterSearch] = useState('');

  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'created_at', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(
    () => ['student', 'subject', 'status', 'ucat_tier', 'granted', 'notes'],
    [],
  );

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
    filterKeys: ['student', 'subject', 'from', 'to'],
  });

  const { data: studentSearchData } = useStudentSearchForFilter(studentFilterSearch, [
    'ACTIVE',
    'TRIAL',
  ]);
  const { data: subjectSearchData } = useSubjectsSearchForFilter(subjectFilterSearch);

  const filteredStudents = useMemo(
    () => studentSearchData?.students ?? [],
    [studentSearchData?.students],
  );
  const filteredSubjects = useMemo(
    () => subjectSearchData?.subjects ?? [],
    [subjectSearchData?.subjects],
  );

  const { rows, total, isLoading, isFetching, error, refetch } = useManualOnlineAccessTable(state);

  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'student',
        label: 'Student',
        options: filteredStudents.map((s) => ({
          label: `${s.first_name} ${s.last_name}`,
          value: s.id,
        })),
        searchable: true,
        searchPlaceholder: 'Search students...',
      },
      {
        key: 'subject',
        label: 'Subject',
        options: filteredSubjects.map((s) => ({
          label: s.long_name ?? s.name ?? s.short_name ?? s.id,
          value: s.id,
        })),
        searchable: true,
        searchPlaceholder: 'Search subjects...',
      },
      {
        key: 'date',
        label: 'Granted',
        type: 'date-range',
        fromKey: 'from',
        toKey: 'to',
      },
    ],
    [filteredStudents, filteredSubjects],
  );

  const sortOptions: DataTableSortOption[] = [
    { key: 'created_at', label: 'Granted' },
    { key: 'student_name', label: 'Student' },
    { key: 'subject_name', label: 'Subject' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'student', label: 'Student' },
    { key: 'subject', label: 'Subject' },
    { key: 'status', label: 'Status' },
    { key: 'ucat_tier', label: 'UCAT tier override' },
    { key: 'granted', label: 'Granted' },
    { key: 'notes', label: 'Notes' },
  ];

  const revokeMutation = useMutation({
    mutationFn: (id: string) => manualOnlineAccessApi.revoke(id),
    onSuccess: () => {
      toast({ title: 'Access removed' });
      queryClient.invalidateQueries({ queryKey: ['manual-online-access'] });
      setRevokeId(null);
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not remove access',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const hasActiveFilters =
    state.search.trim().length > 0 || Object.keys(state.filters).some((k) => (state.filters[k] ?? []).length > 0);

  if (isLoading && total === 0 && !error) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manual online access</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Grant or revoke admin manual online access for any student and subject. UCAT grants set Force UCAT
              Pro; revoking the last UCAT grant resets to Default. Use tier override to force UCAT Free.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTierOverrideOpen(true)} disabled>
              <Shield className="h-4 w-4 mr-2" />
              Set UCAT tier
            </Button>
            <Button onClick={() => setAddOpen(true)} disabled>
              <Plus className="h-4 w-4 mr-2" />
              Grant access
            </Button>
          </div>
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
          quickFilters={[]}
          filterSearchValues={{
            student: studentFilterSearch,
            subject: subjectFilterSearch,
          }}
          onFilterSearchChange={(filterKey, value) => {
            if (filterKey === 'student') setStudentFilterSearch(value);
            if (filterKey === 'subject') setSubjectFilterSearch(value);
          }}
          searchPlaceholder="Search by student, subject, notes..."
          isLoading
        />
        <SkeletonTable rows={8} columns={state.visibleColumns.length + 1} />
        <p className="text-sm text-muted-foreground">Loading manual online access…</p>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{(error as Error).message}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manual online access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant or revoke admin manual online access for any student and subject. UCAT grants set Force UCAT
            Pro; revoking the last UCAT grant resets to Default. Use tier override to force UCAT Free.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTierOverrideOpen(true)}>
            <Shield className="h-4 w-4 mr-2" />
            Set UCAT tier
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Grant access
          </Button>
        </div>
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
        quickFilters={[]}
        filterSearchValues={{
          student: studentFilterSearch,
          subject: subjectFilterSearch,
        }}
        onFilterSearchChange={(filterKey, value) => {
          if (filterKey === 'student') setStudentFilterSearch(value);
          if (filterKey === 'subject') setSubjectFilterSearch(value);
        }}
        searchPlaceholder="Search by student, subject, notes..."
        isLoading={isFetching}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('student') && (
                <TableHead
                  className="cursor-pointer"
                  onClick={() =>
                    setSort(
                      'student_name',
                      state.sortBy === 'student_name' && state.sortDirection === 'asc' ? 'desc' : 'asc',
                    )
                  }
                >
                  Student
                  <ArrowUpDown
                    className={cn(
                      'ml-2 h-4 w-4 inline',
                      state.sortBy === 'student_name' ? 'opacity-100' : 'opacity-40',
                    )}
                  />
                </TableHead>
              )}
              {state.visibleColumns.includes('subject') && (
                <TableHead
                  className="cursor-pointer"
                  onClick={() =>
                    setSort(
                      'subject_name',
                      state.sortBy === 'subject_name' && state.sortDirection === 'asc' ? 'desc' : 'asc',
                    )
                  }
                >
                  Subject
                  <ArrowUpDown
                    className={cn(
                      'ml-2 h-4 w-4 inline',
                      state.sortBy === 'subject_name' ? 'opacity-100' : 'opacity-40',
                    )}
                  />
                </TableHead>
              )}
              {state.visibleColumns.includes('status') && <TableHead>Status</TableHead>}
              {state.visibleColumns.includes('ucat_tier') && <TableHead>UCAT tier override</TableHead>}
              {state.visibleColumns.includes('granted') && (
                <TableHead
                  className="cursor-pointer"
                  onClick={() =>
                    setSort(
                      'created_at',
                      state.sortBy === 'created_at' && state.sortDirection === 'asc' ? 'desc' : 'asc',
                    )
                  }
                >
                  Granted
                  <ArrowUpDown
                    className={cn(
                      'ml-2 h-4 w-4 inline',
                      state.sortBy === 'created_at' ? 'opacity-100' : 'opacity-40',
                    )}
                  />
                </TableHead>
              )}
              {state.visibleColumns.includes('notes') && <TableHead>Notes</TableHead>}
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={state.visibleColumns.length + 1}
                  className="text-center h-24 text-muted-foreground"
                >
                  {hasActiveFilters
                    ? 'No rows match your filters.'
                    : 'No manual online access rows yet.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const st = row.student;
                const sub = row.subject;
                return (
                  <TableRow key={row.id}>
                    {state.visibleColumns.includes('student') && (
                      <TableCell>
                        {st ? (
                          <Link
                            href={`/students/${st.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {st.first_name} {st.last_name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('subject') && (
                      <TableCell className="font-medium">
                        {sub?.name ?? '—'}
                        {sub?.short_name ? (
                          <span className="text-muted-foreground"> ({sub.short_name})</span>
                        ) : null}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('status') && (
                      <TableCell>{st?.status ?? '—'}</TableCell>
                    )}
                    {state.visibleColumns.includes('ucat_tier') && (
                      <TableCell className="text-muted-foreground">
                        {sub?.name === 'UCAT' && st?.ucat_online_tier_override
                          ? UCAT_TIER_OVERRIDE_LABELS[st.ucat_online_tier_override]
                          : sub?.name === 'UCAT'
                            ? UCAT_TIER_OVERRIDE_LABELS.default
                            : '—'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('granted') && (
                      <TableCell className="text-muted-foreground">
                        {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('notes') && (
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {row.notes ?? '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label="Remove access"
                        onClick={() => setRevokeId(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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

      <AddUcatOnlineAccessModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onGranted={() => queryClient.invalidateQueries({ queryKey: ['manual-online-access'] })}
      />

      <SetUcatTierOverrideModal
        isOpen={tierOverrideOpen}
        onClose={() => setTierOverrideOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['manual-online-access'] })}
      />

      <AlertDialog open={revokeId != null} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove manual online access?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the manual grant for this student and subject. They may still have access via a class or
              subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
