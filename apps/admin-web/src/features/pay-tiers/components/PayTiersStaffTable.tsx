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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  DataTableToolbar,
  SkeletonTable,
} from '@altitutor/ui';
import { ArrowUpDown } from 'lucide-react';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { cn } from '@/shared/utils';
import { usePayTiersStaffSummaries } from '../hooks';
import { PayTiersStaffPanel } from './PayTiersStaffPanel';
import { formatCheckInRecency } from '@/features/reconciliation/utils/formatCheckInRecency';

type StaffSummary = {
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  currentTierNumber: number;
  nextTierNumber: number | null;
  isEligibleForReview: boolean;
  lastCheckIn: { sessionId: string; startAt: string; longName: string | null } | null;
};

type StaffRow = StaffSummary & {
  name: string;
};

export function PayTiersStaffTable() {
  const { data: staffRaw = [], isLoading, isError, refetch, isFetching } = usePayTiersStaffSummaries();
  const [selected, setSelected] = useState<StaffRow | null>(null);

  const staff = useMemo(
    () =>
      staffRaw.map((s) => ({
        ...s,
        name: `${s.firstName} ${s.lastName}`.trim(),
      })),
    [staffRaw]
  );

  const defaultVisibleColumns = useMemo(
    () => ['name', 'role', 'currentTier', 'status', 'lastCheckIn'],
    []
  );

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setVisibleColumns,
    resetFilters,
  } = useDataTable({
    defaultFilters: {},
    defaultSort: { field: 'name', direction: 'asc' },
    defaultVisibleColumns,
    filterKeys: ['role', 'reviewStatus'],
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'role',
        label: 'Role',
        options: [
          { label: 'Tutor', value: 'TUTOR' },
          { label: 'Admin staff', value: 'ADMINSTAFF' },
        ],
      },
      {
        key: 'reviewStatus',
        label: 'Review status',
        options: [
          { label: 'Eligible for review', value: 'eligible' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'Top tier', value: 'top_tier' },
        ],
      },
    ],
    []
  );

  const sortOptions: DataTableSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'currentTier', label: 'Current tier' },
    { key: 'lastCheckIn', label: 'Last check-in' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'currentTier', label: 'Current tier' },
    { key: 'status', label: 'Status' },
    { key: 'lastCheckIn', label: 'Last check-in' },
  ];

  const filteredRows = useMemo(() => {
    let rows = [...staff];

    const q = state.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          String(r.currentTierNumber).includes(q)
      );
    }

    const roles = state.filters.role as string[] | undefined;
    if (roles?.length) {
      rows = rows.filter((r) => roles.includes(r.role));
    }

    const reviewStatuses = state.filters.reviewStatus as string[] | undefined;
    if (reviewStatuses?.length) {
      rows = rows.filter((r) => {
        const key = r.isEligibleForReview
          ? 'eligible'
          : r.nextTierNumber
            ? 'in_progress'
            : 'top_tier';
        return reviewStatuses.includes(key);
      });
    }

    const field = state.sortBy ?? 'name';
    const dir = state.sortDirection === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (field) {
        case 'role':
          av = a.role;
          bv = b.role;
          break;
        case 'currentTier':
          av = a.currentTierNumber;
          bv = b.currentTierNumber;
          break;
        case 'lastCheckIn':
          av = a.lastCheckIn?.startAt ?? '';
          bv = b.lastCheckIn?.startAt ?? '';
          break;
        default:
          av = a.name;
          bv = b.name;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return rows;
  }, [staff, state.search, state.filters, state.sortBy, state.sortDirection]);

  const toggleSort = (field: string) => {
    setSort(field, state.sortBy === field && state.sortDirection === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading && staff.length === 0) {
    return (
      <div className="space-y-4">
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
          searchPlaceholder="Search staff..."
          isLoading
        />
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load staff pay tiers.
        <button type="button" onClick={() => refetch()} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
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
          searchPlaceholder="Search staff..."
          isLoading={isFetching}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('name') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'name' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
                {state.visibleColumns.includes('role') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('role')}
                  >
                    <div className="flex items-center">
                      Role
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'role' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
                {state.visibleColumns.includes('currentTier') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('currentTier')}
                  >
                    <div className="flex items-center">
                      Current tier
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'currentTier' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
                {state.visibleColumns.includes('status') && (
                  <TableHead>Status</TableHead>
                )}
                {state.visibleColumns.includes('lastCheckIn') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('lastCheckIn')}
                  >
                    <div className="flex items-center">
                      Last check-in
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'lastCheckIn' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={state.visibleColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No staff match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((s) => (
                  <TableRow
                    key={s.staffId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(s)}
                  >
                    {state.visibleColumns.includes('name') && (
                      <TableCell className="font-medium">{s.name}</TableCell>
                    )}
                    {state.visibleColumns.includes('role') && (
                      <TableCell>{s.role}</TableCell>
                    )}
                    {state.visibleColumns.includes('currentTier') && (
                      <TableCell>Tier {s.currentTierNumber}</TableCell>
                    )}
                    {state.visibleColumns.includes('status') && (
                      <TableCell>
                        {s.isEligibleForReview ? (
                          <Badge>Eligible for review</Badge>
                        ) : s.nextTierNumber ? (
                          <span className="text-muted-foreground text-sm">In progress</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Top tier</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('lastCheckIn') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {s.lastCheckIn
                          ? formatCheckInRecency(s.lastCheckIn.startAt)
                          : 'Never'}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredRows.length} of {staff.length} active staff
        </p>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.name ?? 'Pay tier'}</SheetTitle>
          </SheetHeader>
          {selected && (
            <PayTiersStaffPanel
              staffId={selected.staffId}
              staffName={selected.name}
              staffFirstName={selected.firstName}
              staffLastName={selected.lastName}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
