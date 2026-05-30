'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DataTableToolbar,
  SkeletonTable,
} from '@altitutor/ui';
import { ArrowUpDown, Plus } from 'lucide-react';
import type { DataTableColumnDefinition, DataTableSortOption } from '@altitutor/shared';
import { formatPayRate, type StaffPayTier } from '@altitutor/shared/pay-tiers';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { cn } from '@/shared/utils';
import { usePayTiers, usePayTierRequirementCounts, useCreatePayTier } from '../hooks';
import { PayTierEditDialog } from './PayTierEditDialog';

type TierRow = StaffPayTier & {
  requirementCount: number;
  isTopTier: boolean;
};

export function PayTiersLadderTable() {
  const { data: tiers = [], isLoading, isError, refetch, isFetching } = usePayTiers();
  const createTier = useCreatePayTier();
  const [editingTier, setEditingTier] = useState<StaffPayTier | null>(null);

  const tierNumbers = useMemo(() => tiers.map((t) => t.tier_number), [tiers]);
  const maxTierNumber = tierNumbers.length > 0 ? Math.max(...tierNumbers) : 0;
  const requirementQueries = usePayTierRequirementCounts(tierNumbers);

  const rows: TierRow[] = useMemo(
    () =>
      tiers.map((tier, index) => ({
        ...tier,
        requirementCount: requirementQueries[index]?.data?.length ?? 0,
        isTopTier: tier.tier_number === maxTierNumber,
      })),
    [tiers, requirementQueries, maxTierNumber]
  );

  const defaultVisibleColumns = useMemo(
    () => ['tierNumber', 'name', 'basePay', 'requirements'],
    []
  );

  const {
    state,
    setSearch,
    setSort,
    setVisibleColumns,
    resetFilters,
  } = useDataTable({
    defaultFilters: {},
    defaultSort: { field: 'tierNumber', direction: 'asc' },
    defaultVisibleColumns,
    filterKeys: [],
  });

  const sortOptions: DataTableSortOption[] = [
    { key: 'tierNumber', label: 'Tier' },
    { key: 'name', label: 'Name' },
    { key: 'basePay', label: 'Base pay' },
    { key: 'requirements', label: 'Requirements' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'tierNumber', label: 'Tier' },
    { key: 'name', label: 'Name' },
    { key: 'basePay', label: 'Base pay' },
    { key: 'requirements', label: 'Requirements' },
  ];

  const filteredRows = useMemo(() => {
    let list = [...rows];
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.tier_number).includes(q) ||
          (r.name ?? '').toLowerCase().includes(q) ||
          formatPayRate(r.base_pay_rate_cents, r.currency).toLowerCase().includes(q)
      );
    }

    const field = state.sortBy ?? 'tierNumber';
    const dir = state.sortDirection === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (field) {
        case 'name':
          av = a.name ?? '';
          bv = b.name ?? '';
          break;
        case 'basePay':
          av = a.base_pay_rate_cents;
          bv = b.base_pay_rate_cents;
          break;
        case 'requirements':
          av = a.requirementCount;
          bv = b.requirementCount;
          break;
        default:
          av = a.tier_number;
          bv = b.tier_number;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return list;
  }, [rows, state.search, state.sortBy, state.sortDirection]);

  const toggleSort = (field: string) => {
    setSort(field, state.sortBy === field && state.sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const nextTierNumber = maxTierNumber + 1;

  const handleAddTier = async () => {
    await createTier.mutateAsync({
      tier_number: nextTierNumber,
      base_pay_rate_cents: 0,
      name: `Tier ${nextTierNumber}`,
    });
  };

  if (isLoading && tiers.length === 0) {
    return (
      <div className="space-y-4">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={() => {}}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          searchPlaceholder="Search tiers..."
          isLoading
        />
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load pay tiers.
        <button type="button" onClick={() => refetch()} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Click a tier to edit pay rate and advancement requirements.
          </p>
          <Button variant="outline" disabled={createTier.isPending} onClick={handleAddTier}>
            <Plus className="h-4 w-4 mr-2" />
            Add tier {nextTierNumber}
          </Button>
        </div>

        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={() => {}}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          searchPlaceholder="Search tiers..."
          isLoading={isFetching}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('tierNumber') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('tierNumber')}
                  >
                    <div className="flex items-center">
                      Tier
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'tierNumber' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
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
                {state.visibleColumns.includes('basePay') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('basePay')}
                  >
                    <div className="flex items-center">
                      Base pay
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'basePay' ? 'opacity-100' : 'opacity-40'
                        )}
                      />
                    </div>
                  </TableHead>
                )}
                {state.visibleColumns.includes('requirements') && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => toggleSort('requirements')}
                  >
                    <div className="flex items-center">
                      Requirements
                      <ArrowUpDown
                        className={cn(
                          'ml-2 h-4 w-4',
                          state.sortBy === 'requirements' ? 'opacity-100' : 'opacity-40'
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
                    No tiers match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((tier) => (
                  <TableRow
                    key={tier.tier_number}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setEditingTier(tier)}
                  >
                    {state.visibleColumns.includes('tierNumber') && (
                      <TableCell className="font-medium">{tier.tier_number}</TableCell>
                    )}
                    {state.visibleColumns.includes('name') && (
                      <TableCell>{tier.name ?? '—'}</TableCell>
                    )}
                    {state.visibleColumns.includes('basePay') && (
                      <TableCell>
                        {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('requirements') && (
                      <TableCell className="text-muted-foreground">
                        {tier.isTopTier ? '—' : tier.requirementCount}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredRows.length} of {rows.length} tiers
        </p>
      </div>

      <PayTierEditDialog
        tier={editingTier}
        open={!!editingTier}
        onOpenChange={(open) => !open && setEditingTier(null)}
        isTopTier={editingTier?.tier_number === maxTierNumber}
        canDelete={
          !!editingTier && editingTier.tier_number === maxTierNumber && tiers.length > 1
        }
      />
    </>
  );
}
