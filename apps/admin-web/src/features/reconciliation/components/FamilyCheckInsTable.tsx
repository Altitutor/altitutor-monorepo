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
  title,
  entity,
  items,
  isLoading,
}: {
  title: string;
  entity: FamilyCheckInsEntity;
  items: FamilyCheckInRow[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  const { openCheckInModal } = useQuickActions();
  const { data: currentStaff } = useCurrentStaff();

  const [tableState, setTableState] = useState<DataTableState>(INITIAL_TABLE_STATE);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'staleness',
        label: 'Time since last check-in',
        type: 'multi-select',
        options: STALENESS_FILTER_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      },
    ],
    []
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
  }, [items, tableState]);

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
    (id: string) => {
      if (entity === 'staff') handlers.onOpenStaff(id);
      else if (entity === 'student') handlers.onOpenStudent(id);
      else handlers.onOpenParent(id);
    },
    [entity, handlers]
  );

  const openCreateCheckIn = useCallback(
    (row: FamilyCheckInRow) => {
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
      if (entity === 'staff') {
        openCheckInModal({
          staff: dedupeStaffPrefill([targetStaff, self]),
        });
      } else if (entity === 'student') {
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
    [currentStaff, entity, openCheckInModal]
  );

  const showName = tableState.visibleColumns.includes('name');
  const showLast = tableState.visibleColumns.includes('lastSession');
  const showRecency = tableState.visibleColumns.includes('recency');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      <DataTableToolbar
        state={tableState}
        onSearchChange={onSearchChange}
        onFiltersChange={onFiltersChange}
        onSortChange={onSortChange}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={(cols) =>
          setTableState((s) => ({ ...s, visibleColumns: cols.length ? cols : s.visibleColumns }))
        }
        onQuickFilterApply={() => {}}
        onReset={onReset}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={[]}
        searchPlaceholder={`Search ${entity === 'staff' ? 'staff' : entity === 'student' ? 'students' : 'parents'}…`}
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
                <TableRow key={row.entityId}>
                  {showName ? (
                    <TableCell>
                      <LinkishButton onClick={() => openProfile(row.entityId)} className="font-medium">
                        {displayName(row)}
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
