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
import { Plus } from 'lucide-react';
import type { DataTableColumnDefinition } from '@altitutor/shared';
import { formatPayRate, type StaffPayTier } from '@altitutor/shared/pay-tiers';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { usePayTiers, usePayTierRequirementCounts, useCreatePayTier } from '../hooks';
import type { PayTierRequirementRow } from './PayTierRequirementEditor';
import {
  formatTierRequirementLabel,
  formatTierRequirementLabels,
} from '../utils/formatTierRequirements';
import { PayTierEditDialog } from './PayTierEditDialog';

type TierRow = StaffPayTier & {
  requirements: PayTierRequirementRow[];
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
      tiers
        .map((tier, index) => ({
          ...tier,
          requirements: (requirementQueries[index]?.data ?? []) as PayTierRequirementRow[],
          isTopTier: tier.tier_number === maxTierNumber,
        }))
        .sort((a, b) => a.tier_number - b.tier_number),
    [tiers, requirementQueries, maxTierNumber]
  );

  const defaultVisibleColumns = useMemo(
    () => ['tierNumber', 'name', 'basePay', 'requirements'],
    []
  );

  const { state, setSearch, setVisibleColumns, resetFilters } = useDataTable({
    defaultFilters: {},
    defaultSort: { field: 'tierNumber', direction: 'asc' },
    defaultVisibleColumns,
    filterKeys: [],
  });

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'tierNumber', label: 'Tier' },
    { key: 'name', label: 'Name' },
    { key: 'basePay', label: 'Base pay' },
    { key: 'requirements', label: 'Requirements' },
  ];

  const filteredRows = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const requirementText = formatTierRequirementLabels(r.requirements).join(' ').toLowerCase();
      return (
        String(r.tier_number).includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        formatPayRate(r.base_pay_rate_cents, r.currency).toLowerCase().includes(q) ||
        requirementText.includes(q)
      );
    });
  }, [rows, state.search]);

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
          onSortChange={() => {}}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
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
          onSortChange={() => {}}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={() => {}}
          onReset={resetFilters}
          columnDefinitions={columnDefinitions}
          searchPlaceholder="Search tiers..."
          isLoading={isFetching}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('tierNumber') && <TableHead>Tier</TableHead>}
                {state.visibleColumns.includes('name') && <TableHead>Name</TableHead>}
                {state.visibleColumns.includes('basePay') && <TableHead>Base pay</TableHead>}
                {state.visibleColumns.includes('requirements') && (
                  <TableHead>Requirements to advance</TableHead>
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
                filteredRows.map((tier) => {
                  return (
                    <TableRow
                      key={tier.tier_number}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setEditingTier(tier)}
                    >
                      {state.visibleColumns.includes('tierNumber') && (
                        <TableCell className="font-medium align-top">{tier.tier_number}</TableCell>
                      )}
                      {state.visibleColumns.includes('name') && (
                        <TableCell className="align-top">{tier.name ?? '—'}</TableCell>
                      )}
                      {state.visibleColumns.includes('basePay') && (
                        <TableCell className="align-top whitespace-nowrap">
                          {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('requirements') && (
                        <TableCell className="align-top text-sm text-muted-foreground max-w-md">
                          {tier.isTopTier ? (
                            '—'
                          ) : tier.requirements.length === 0 ? (
                            <span className="text-xs">None</span>
                          ) : (
                            <ul className="space-y-0.5 list-disc list-inside">
                              {tier.requirements.map((req) => (
                                <li key={req.id}>{formatTierRequirementLabel(req)}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
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
