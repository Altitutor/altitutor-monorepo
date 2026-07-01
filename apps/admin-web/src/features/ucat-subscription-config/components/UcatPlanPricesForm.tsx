'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
} from '@altitutor/ui';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';
import {
  ucatPlanPricesApi,
  type UcatPlanPriceRow,
} from '../api/ucat-plan-prices';

const TIER_LABELS: Record<string, string> = {
  unlimited: 'UCAT Unlimited',
  pro: 'UCAT Pro',
};

const INTERVAL_LABELS: Record<string, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

type EditablePriceRow = UcatPlanPriceRow & {
  tierLabel: string;
  intervalLabel: string;
  basePriceInput: string;
  stripePriceInput: string;
};

function toEditable(row: UcatPlanPriceRow): EditablePriceRow {
  return {
    ...row,
    tierLabel: TIER_LABELS[row.plan_tier] ?? row.plan_tier,
    intervalLabel: INTERVAL_LABELS[row.billing_interval] ?? row.billing_interval,
    basePriceInput: String(row.base_price_cents),
    stripePriceInput: row.stripe_price_id ?? '',
  };
}

export function UcatPlanPricesForm() {
  const [rows, setRows] = useState<EditablePriceRow[]>([]);
  const [editingRow, setEditingRow] = useState<EditablePriceRow | null>(null);
  const [basePriceInput, setBasePriceInput] = useState('');
  const [stripePriceInput, setStripePriceInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ucatPlanPricesApi.list();
      setRows(data.map(toEditable));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan prices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingRow) return;
    setBasePriceInput(editingRow.basePriceInput);
    setStripePriceInput(editingRow.stripePriceInput);
    setError(null);
  }, [editingRow]);

  const columns = useMemo<SettingsDataTableColumn<EditablePriceRow>[]>(
    () => [
      {
        key: 'plan_tier',
        label: 'Tier',
        render: (row) => <span className="font-medium">{row.tierLabel}</span>,
        sortValue: (row) => row.tierLabel,
        searchValue: (row) => `${row.tierLabel} ${row.intervalLabel} ${row.stripe_price_id ?? ''}`,
      },
      {
        key: 'billing_interval',
        label: 'Interval',
        render: (row) => row.intervalLabel,
        sortValue: (row) => row.intervalLabel,
      },
      {
        key: 'base_price_cents',
        label: 'Base price',
        render: (row) => <span className="font-mono tabular-nums">{row.base_price_cents}c</span>,
        sortValue: (row) => row.base_price_cents,
      },
      {
        key: 'stripe_price_id',
        label: 'Stripe price ID',
        render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.stripe_price_id ?? 'Not set'}</span>,
        sortValue: (row) => row.stripe_price_id ?? '',
        searchValue: (row) => row.stripe_price_id ?? '',
      },
    ],
    [],
  );

  async function handleSave() {
    if (!editingRow) return;
    const base = parseInt(basePriceInput, 10);
    if (!Number.isFinite(base) || base < 0) {
      setError('Base price must be 0 or greater');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await ucatPlanPricesApi.update(editingRow.id, {
        base_price_cents: base,
        stripe_price_id: stripePriceInput.trim() || null,
      });
      await load();
      setEditingRow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan price');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncFromStripe(row: EditablePriceRow) {
    if (!row.stripe_price_id?.trim()) {
      setError('Enter a Stripe price ID before syncing');
      setEditingRow(row);
      return;
    }

    setSyncingId(row.id);
    setError(null);
    try {
      await ucatPlanPricesApi.syncBasePriceFromStripe(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync from Stripe');
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <>
      {error && !editingRow ? <p className="text-sm text-destructive">{error}</p> : null}
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search plan prices..."
        defaultSort={{ field: 'plan_tier', direction: 'asc' }}
        isLoading={loading}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => setEditingRow(row),
          },
          {
            id: 'sync',
            label: syncingId === row.id ? 'Syncing...' : 'Sync from Stripe',
            disabled: syncingId === row.id,
            onSelect: () => void handleSyncFromStripe(row),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        title={editingRow ? `Edit ${editingRow.tierLabel} ${editingRow.intervalLabel}` : 'Edit plan price'}
        subtitle="Configure the list price and Stripe price ID for this UCAT billing interval."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditingRow(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save price'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="base-price-cents">Base price (cents)</Label>
            <Input
              id="base-price-cents"
              type="number"
              min={0}
              value={basePriceInput}
              onChange={(event) => setBasePriceInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-price-id">Stripe price ID</Label>
            <Input
              id="stripe-price-id"
              value={stripePriceInput}
              onChange={(event) => setStripePriceInput(event.target.value)}
              placeholder="price_..."
            />
          </div>
        </div>
        {error && editingRow ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </AdminDialogShell>
    </>
  );
}
