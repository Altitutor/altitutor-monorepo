'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  DataTableToolbar,
  TablePagination,
} from '@altitutor/ui';
import type {
  DataTableState,
  DataTableFilterDefinition,
  DataTableSortOption,
  DataTableColumnDefinition,
} from '@altitutor/shared';
import { cn } from '@/shared/utils';
import type { FamilyCheckInRow } from '../types';
import {
  formatCheckInRecency,
  lastCheckInSortKey,
  STALENESS_FILTER_OPTIONS,
  maxStalenessMinDays,
  matchesStalenessFilter,
  type StalenessFilterId,
} from '../utils/formatCheckInRecency';
import { useReconciliationHandlers } from './ReconciliationActions';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { useCurrentStaff } from '@/shared/hooks';
import { encodeViewConfig, readViewSettings, type QuickFilter } from '@altitutor/shared';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';

export type FamilyCheckInsEntity = 'staff' | 'student' | 'parent';

const INITIAL_TABLE_STATE: DataTableState = {
  search: '',
  filters: {},
  sortBy: 'lastCheckInAt',
  sortDirection: 'asc',
  groupBy: null,
  page: 1,
  pageSize: 20,
  visibleColumns: ['name', 'lastSession', 'recency'],
};

function displayName(row: FamilyCheckInRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || '—';
}

function LinkishButton({
  children,
  onClick,
  className,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  if (disabled) {
    return (
      <span className={cn('text-muted-foreground', className)} title={title}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'cursor-pointer border-0 bg-transparent p-0 text-left text-primary underline-offset-4 hover:underline',
        className,
      )}
    >
      {children}
    </button>
  );
}

function dedupeStaffPrefill(
  entries: Array<{ id: string; first_name?: string | null; last_name?: string | null }>
) {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

export function FamilyCheckInsTable({
  title: _title,
  entity,
  items,
  isLoading,
}: {
  title: string;
  entity: FamilyCheckInsEntity | 'all';
  items: Array<FamilyCheckInRow & { entity?: FamilyCheckInsEntity }>;
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  const { openCheckInModal } = useQuickActions();
  const { data: currentStaff } = useCurrentStaff();

  const [tableState, setTableState] = useState<DataTableState>(INITIAL_TABLE_STATE);
  const { data: savedViews = [] } = useQuickFilters('check-ins');
  const views: QuickFilter[] = [
    { name: 'All check-ins', values: [] }, { name: 'Staff', values: ['staff'] },
    { name: 'Students', values: ['student'] }, { name: 'Parents', values: ['parent'] },
  ].map(({ name, values }) => ({
    id: `builtin:check-ins:${name}`, name, target_entity: 'check-ins', user_id: null, created_at: '', updated_at: '',
    config: encodeViewConfig({ filters: values.length ? { entity: values } : {}, sortBy: 'lastCheckInAt', sortDirection: 'asc', groupBy: null, visibleColumns: INITIAL_TABLE_STATE.visibleColumns }),
  }));
  const rowEntity = useCallback((row: FamilyCheckInRow & { entity?: FamilyCheckInsEntity }): FamilyCheckInsEntity => row.entity ?? (entity === 'all' ? 'student' : entity), [entity]);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      ...(entity === 'all' ? [{ key: 'entity', label: 'Audience', type: 'multi-select' as const, options: [{ value: 'staff', label: 'Staff' }, { value: 'student', label: 'Students' }, { value: 'parent', label: 'Parents' }] }] : []),
      {
        key: 'staleness',
        label: 'Time since last check-in',
        type: 'multi-select',
        options: STALENESS_FILTER_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      },
    ],
    [entity]
  );

  const sortOptions: DataTableSortOption[] = useMemo(
    () => [
      { key: 'lastCheckInAt', label: 'Last check-in date' },
      { key: 'name', label: 'Name' },
    ],
    []
  );

  const columnDefinitions: DataTableColumnDefinition[] = useMemo(
    () => [
      { key: 'name', label: 'Name', visibleByDefault: true },
      { key: 'lastSession', label: 'Last check-in', visibleByDefault: true },
      { key: 'recency', label: 'Time since last check-in', visibleByDefault: true },
    ],
    []
  );

  const processed = useMemo(() => {
    let rows = [...items];
    const audiences = tableState.filters.entity ?? [];
    if (audiences.length) rows = rows.filter(row => audiences.includes(rowEntity(row)));
    const q = tableState.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          displayName(r).toLowerCase().includes(q) ||
          (r.lastCheckInLongName ?? '').toLowerCase().includes(q)
      );
    }
    const stalenessVals = (tableState.filters.staleness ?? []) as StalenessFilterId[];
    const minDays = maxStalenessMinDays(stalenessVals);
    if (minDays !== null) {
      rows = rows.filter((r) => matchesStalenessFilter(r.lastCheckInAt, minDays));
    }

    const { sortBy, sortDirection } = tableState;
    rows.sort((a, b) => {
      if (sortBy === 'name') {
        const an = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bn = `${b.lastName} ${b.firstName}`.toLowerCase();
        return sortDirection === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      const ka = lastCheckInSortKey(a.lastCheckInAt);
      const kb = lastCheckInSortKey(b.lastCheckInAt);
      return sortDirection === 'desc' ? kb - ka : ka - kb;
    });
    return rows;
  }, [items, tableState, rowEntity]);

  const totalItems = processed.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.pageSize));
  const paged = useMemo(() => {
    const start = (tableState.page - 1) * tableState.pageSize;
    return processed.slice(start, start + tableState.pageSize);
  }, [processed, tableState.page, tableState.pageSize]);

  useEffect(() => {
    if (tableState.page > totalPages) {
      setTableState((s) => ({ ...s, page: totalPages }));
    }
  }, [tableState.page, totalPages]);

  const onSearchChange = useCallback((search: string) => {
    setTableState((s) => ({ ...s, search, page: 1 }));
  }, []);

  const onFiltersChange = useCallback((filters: Record<string, unknown[]>) => {
    setTableState((s) => ({ ...s, filters, page: 1 }));
  }, []);

  const onSortChange = useCallback((field: string | null, direction: 'asc' | 'desc') => {
    setTableState((s) => ({
      ...s,
      sortBy: field ?? 'lastCheckInAt',
      sortDirection: direction,
      page: 1,
    }));
  }, []);

  const onReset = useCallback(() => {
    setTableState(INITIAL_TABLE_STATE);
  }, []);

  const openProfile = useCallback(
    (row: FamilyCheckInRow & { entity?: FamilyCheckInsEntity }) => {
      const kind = rowEntity(row);
      if (kind === 'staff') handlers.onOpenStaff(row.entityId);
      else if (kind === 'student') handlers.onOpenStudent(row.entityId);
      else handlers.onOpenParent(row.entityId);
    },
    [rowEntity, handlers]
  );

  const openCreateCheckIn = useCallback(
    (row: FamilyCheckInRow & { entity?: FamilyCheckInsEntity }) => {
      if (!currentStaff) return;
      const self = {
        id: currentStaff.id,
        first_name: currentStaff.first_name,
        last_name: currentStaff.last_name,
      };
      const targetStaff = {
        id: row.entityId,
        first_name: row.firstName,
        last_name: row.lastName,
      };
      if (rowEntity(row) === 'staff') {
        openCheckInModal({
          staff: dedupeStaffPrefill([targetStaff, self]),
        });
      } else if (rowEntity(row) === 'student') {
        openCheckInModal({
          staff: [self],
          students: [{ id: row.entityId, first_name: row.firstName, last_name: row.lastName }],
        });
      } else {
        openCheckInModal({
          staff: [self],
          parents: [{ id: row.entityId, first_name: row.firstName, last_name: row.lastName }],
        });
      }
    },
    [currentStaff, rowEntity, openCheckInModal]
  );

  const showName = tableState.visibleColumns.includes('name');
  const showLast = tableState.visibleColumns.includes('lastSession');
  const showRecency = tableState.visibleColumns.includes('recency');

  return (
    <div className="space-y-4">


      <DataTableToolbar
        state={tableState}
        onSearchChange={onSearchChange}
        onFiltersChange={onFiltersChange}
        onSortChange={onSortChange}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={(cols) =>
          setTableState((s) => ({ ...s, visibleColumns: cols.length ? cols : s.visibleColumns }))
        }
        onQuickFilterApply={view => {
          const settings = readViewSettings(view.config, INITIAL_TABLE_STATE, currentStaff?.id);
          setTableState(previous => ({ ...previous, ...settings, page: 1 }));
        }}
        onReset={onReset}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={[...views, ...savedViews]} viewTarget="check-ins"
        searchPlaceholder="Search check-ins…"
        isLoading={!!isLoading}
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {showName ? <TableHead>Name</TableHead> : null}
              {showLast ? <TableHead>Last check-in</TableHead> : null}
              {showRecency ? <TableHead>Time since last check-in</TableHead> : null}
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={(showName ? 1 : 0) + (showLast ? 1 : 0) + (showRecency ? 1 : 0) + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(showName ? 1 : 0) + (showLast ? 1 : 0) + (showRecency ? 1 : 0) + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No rows match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow key={`${rowEntity(row)}:${row.entityId}`}>
                  {showName ? (
                    <TableCell>
                      <LinkishButton onClick={() => openProfile(row)} className="font-medium">
                        {displayName(row)}
                        {entity === 'all' && <span className="ml-2 text-xs text-muted-foreground">{rowEntity(row)}</span>}
                      </LinkishButton>
                    </TableCell>
                  ) : null}
                  {showLast ? (
                    <TableCell>
                      {row.lastCheckInSessionId && row.lastCheckInAt ? (
                        <LinkishButton
                          onClick={() => handlers.onOpenSession(row.lastCheckInSessionId!)}
                          className="max-w-[320px] truncate block"
                          title={row.lastCheckInLongName ?? undefined}
                        >
                          {row.lastCheckInLongName?.trim() || 'Check-in session'}
                        </LinkishButton>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                  {showRecency ? (
                    <TableCell className="tabular-nums">
                      {formatCheckInRecency(row.lastCheckInAt)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={!currentStaff}
                      onClick={() => openCreateCheckIn(row)}
                    >
                      Create check-in
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && totalItems > 0 ? (
        <TablePagination
          page={tableState.page}
          pageSize={tableState.pageSize}
          total={totalItems}
          onPageChange={(page) => setTableState((s) => ({ ...s, page }))}
          onPageSizeChange={(pageSize) => setTableState((s) => ({ ...s, pageSize, page: 1 }))}
        />
      ) : null}
    </div>
  );
}
