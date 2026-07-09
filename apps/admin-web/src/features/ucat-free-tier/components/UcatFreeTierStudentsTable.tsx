'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MoreHorizontal, RotateCcw, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DataTableToolbar,
  Input,
  Label,
  SearchableSelect,
  SmartDatePickerField,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  useToast,
} from '@altitutor/ui';
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared';
import { AdminDialogShell } from '@/shared/components';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { cn } from '@/shared/utils';

type QuotaArea = 'learn' | 'practice' | 'sets' | 'mocks' | 'skill_trainer';

type QuotaCell = {
  area: QuotaArea;
  label: string;
  used: number;
  limit: number;
  period: 'day' | 'week' | 'month';
  disabled: boolean;
  atLimit: boolean;
};

type QuotaRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  timezone: string | null;
  quotas: QuotaCell[];
};

type RowAction =
  | { kind: 'grant'; label: string }
  | { kind: 'reset_area'; area: QuotaArea; label: string };

const AREA_ORDER: QuotaArea[] = ['learn', 'practice', 'sets', 'mocks', 'skill_trainer'];
const RESPONSE_CACHE_TTL_MS = 60_000;

type QuotaResponse = {
  rows: QuotaRow[];
  total: number;
};

const responseCache = new Map<string, { data: QuotaResponse; expiresAt: number }>();

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'student', label: 'Student' },
  { key: 'learn', label: 'Learning modules' },
  { key: 'practice', label: 'Practice questions' },
  { key: 'sets', label: 'Sets' },
  { key: 'mocks', label: 'Mocks' },
  { key: 'skill_trainer', label: 'Skill trainer attempts' },
];

const filterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { label: 'ACTIVE', value: 'ACTIVE' },
      { label: 'TRIAL', value: 'TRIAL' },
      { label: 'INACTIVE', value: 'INACTIVE' },
      { label: 'DISCONTINUED', value: 'DISCONTINUED' },
    ],
  },
];

function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function formatQuota(entry: QuotaCell) {
  if (entry.disabled) return 'Disabled';
  return `${entry.used}/${entry.limit} ${entry.period}`;
}

function studentName(row: QuotaRow) {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.email || row.id;
}

function SelectionToolbar({
  selectedCount,
  onGrantReset,
  onClear,
}: {
  selectedCount: number;
  onGrantReset: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 z-50 -translate-x-1/2',
        'bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
        'w-[calc(100%-2rem)] max-w-3xl',
        'flex items-center gap-3 rounded-lg border bg-popover px-4 py-2 shadow-lg',
      )}
    >
      <span className="shrink-0 text-sm font-medium text-muted-foreground">
        {selectedCount} selected
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onGrantReset}>
          <RotateCcw className="h-4 w-4" />
          Grant reset
        </Button>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function UcatFreeTierStudentsTable() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantStudentIds, setGrantStudentIds] = useState<string[]>([]);
  const [expiresOn, setExpiresOn] = useState(defaultExpiryDate);
  const [pendingReset, setPendingReset] = useState<{ student: QuotaRow; area: QuotaArea; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    state,
    setSearch,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    resetFilters,
  } = useDataTable({
    defaultFilters: {},
    defaultSort: { field: 'first_name', direction: 'asc' },
    defaultVisibleColumns: columnDefinitions.map((column) => column.key),
    filterKeys: ['status'],
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(state.search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state.search]);

  const load = useCallback(async () => {
    const cacheKey = JSON.stringify({
      search: debouncedSearch,
      status: state.filters.status ?? [],
      page: state.page,
      pageSize: state.pageSize,
    });
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setRows(cached.data.rows);
      setTotal(cached.data.total);
      setLoading(false);
      setFetching(false);
      return;
    }

    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (state.filters.status?.length) params.set('status', state.filters.status.join(','));
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));

      const response = await fetch(`/api/ucat/free-tier-quotas?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        rows?: QuotaRow[];
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Failed to load UCAT Free tier students');
      const data = {
        rows: body.rows ?? [],
        total: body.total ?? 0,
      };
      responseCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      });
      setRows(data.rows);
      setTotal(data.total);
    } catch (error) {
      toast({
        title: 'Failed to load UCAT Free tier students',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [debouncedSearch, state.filters.status, state.page, state.pageSize, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => rows.some((row) => row.id === id))));
  }, [rows]);

  const actionItems = useMemo<RowAction[]>(
    () => [
      { kind: 'grant', label: 'Grant quota reset' },
      ...AREA_ORDER.map((area): RowAction => ({
        kind: 'reset_area',
        area,
        label: `Reset ${rows[0]?.quotas.find((quota) => quota.area === area)?.label ?? area} quota`,
      })),
    ],
    [rows],
  );

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  const openGrantDialog = (studentIds: string[]) => {
    setGrantStudentIds(studentIds);
    setExpiresOn(defaultExpiryDate());
    setGrantOpen(true);
  };

  const applyGrant = async () => {
    if (grantStudentIds.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch('/api/ucat/free-tier-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant_entitlement',
          studentIds: grantStudentIds,
          expiresOn,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to grant quota reset');
      setGrantOpen(false);
      toast({ title: 'Quota reset granted' });
      responseCache.clear();
      await load();
    } catch (error) {
      toast({
        title: 'Grant failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const applyAreaReset = async () => {
    if (!pendingReset) return;
    setSaving(true);
    try {
      const response = await fetch('/api/ucat/free-tier-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_area',
          studentIds: [pendingReset.student.id],
          area: pendingReset.area,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to reset quota');
      setPendingReset(null);
      toast({ title: 'Quota reset applied' });
      responseCache.clear();
      await load();
    } catch (error) {
      toast({
        title: 'Reset failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={() => {}}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={[]}
          columnDefinitions={columnDefinitions}
          searchPlaceholder="Search free tier students..."
          isLoading={fetching}
        />

        {loading ? (
          <SkeletonTable rows={8} columns={8} />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected ? true : selectedIds.size > 0 ? 'indeterminate' : false}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) rows.forEach((row) => next.add(row.id));
                          else rows.forEach((row) => next.delete(row.id));
                          return next;
                        });
                      }}
                    />
                  </TableHead>
                  {state.visibleColumns.includes('student') ? <TableHead>Student</TableHead> : null}
                  {AREA_ORDER.map((area) =>
                    state.visibleColumns.includes(area) ? (
                      <TableHead key={area}>{rows[0]?.quotas.find((quota) => quota.area === area)?.label ?? area}</TableHead>
                    ) : null,
                  )}
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No UCAT Free students match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      {state.visibleColumns.includes('student') ? (
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{studentName(row)}</div>
                            <div className="text-xs text-muted-foreground">{row.email ?? '-'}</div>
                          </div>
                        </TableCell>
                      ) : null}
                      {AREA_ORDER.map((area) => {
                        const quota = row.quotas.find((entry) => entry.area === area);
                        if (!quota || !state.visibleColumns.includes(area)) return null;
                        return (
                          <TableCell key={area}>
                            <Badge
                              variant={quota.atLimit ? 'destructive' : 'outline'}
                              className={cn('font-mono tabular-nums', quota.disabled && 'text-muted-foreground')}
                            >
                              {formatQuota(quota)}
                            </Badge>
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <SearchableSelect<RowAction>
                          items={actionItems}
                          value={null}
                          onValueChange={(action) => {
                            if (!action) return;
                            if (action.kind === 'grant') {
                              openGrantDialog([row.id]);
                            } else {
                              setPendingReset({ student: row, area: action.area, label: action.label });
                            }
                          }}
                          getItemLabel={(item) => item.label}
                          getItemId={(item) => item.kind === 'grant' ? item.kind : `${item.kind}-${item.area}`}
                          placeholder="Actions"
                          searchPlaceholder="Search actions..."
                          align="end"
                          contentWidth="260px"
                          renderItem={(item) => (
                            <div className="flex min-w-0 items-center gap-2">
                              <RotateCcw className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </div>
                          )}
                          trigger={
                            <Button type="button" variant="outline" size="icon" aria-label={`Quota actions for ${studentName(row)}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <TablePagination
          page={state.page}
          pageSize={state.pageSize}
          total={total}
          isFetching={fetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <SelectionToolbar
        selectedCount={selectedIds.size}
        onGrantReset={() => openGrantDialog(Array.from(selectedIds))}
        onClear={() => setSelectedIds(new Set())}
      />

      <AdminDialogShell
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant quota reset"
        subtitle={`This gives ${grantStudentIds.length === 1 ? 'this student' : `${grantStudentIds.length} students`} one explicit-use reset for all UCAT Free quota areas.`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setGrantOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={applyGrant} disabled={saving || !expiresOn}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="expiresOn">Expiry date</Label>
          <SmartDatePickerField value={expiresOn} onChange={(value) => setExpiresOn(value ?? '')} />
        </div>
      </AdminDialogShell>

      <AlertDialog open={Boolean(pendingReset)} onOpenChange={(open) => !open && setPendingReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset quota?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately resets {pendingReset?.label.replace(/^Reset /, '').toLowerCase()} for {pendingReset ? studentName(pendingReset.student) : 'this student'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyAreaReset} disabled={saving}>
              {saving ? 'Resetting...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
