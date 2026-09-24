'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
} from '@altitutor/ui';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';
import {
  ucatPracticeDayDiscountConfigApi,
  type UcatPracticeDayDiscountConfigRow,
} from '../api/ucat-practice-day-discount-config';

const INTERVAL_LABELS: Record<string, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

const CAP_LIMITS: Record<string, number> = {
  week: 7,
  month: 30,
  year: 365,
};

type EditableDiscountRow = UcatPracticeDayDiscountConfigRow & {
  intervalLabel: string;
  discountInput: string;
  maxDiscountsInput: string;
};

function toEditable(row: UcatPracticeDayDiscountConfigRow): EditableDiscountRow {
  return {
    ...row,
    intervalLabel: INTERVAL_LABELS[row.billing_interval] ?? row.billing_interval,
    discountInput: String(row.discount_per_day_cents),
    maxDiscountsInput: String(row.max_discounts_per_period),
  };
}

export function UcatPracticeDayDiscountForm() {
  const [rows, setRows] = useState<EditableDiscountRow[]>([]);
  const [editingRow, setEditingRow] = useState<EditableDiscountRow | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [maxDiscountsInput, setMaxDiscountsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ucatPracticeDayDiscountConfigApi.list();
      setRows(data.map(toEditable));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discount config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingRow) return;
    setDiscountInput(editingRow.discountInput);
    setMaxDiscountsInput(editingRow.maxDiscountsInput);
    setError(null);
  }, [editingRow]);

  const columns = useMemo<SettingsDataTableColumn<EditableDiscountRow>[]>(
    () => [
      {
        key: 'billing_interval',
        label: 'Interval',
        render: (row) => <span className="font-medium">{row.intervalLabel}</span>,
        sortValue: (row) => row.intervalLabel,
        searchValue: (row) => row.intervalLabel,
      },
      {
        key: 'discount_per_day_cents',
        label: 'Discount/day',
        render: (row) => <span className="font-mono tabular-nums">{row.discount_per_day_cents}c</span>,
        sortValue: (row) => row.discount_per_day_cents,
      },
      {
        key: 'max_discounts_per_period',
        label: 'Max discounts',
        render: (row) => <span className="font-mono tabular-nums">{row.max_discounts_per_period}</span>,
        sortValue: (row) => row.max_discounts_per_period,
      },
      {
        key: 'cap',
        label: 'Cap',
        render: (row) => <span className="text-muted-foreground">Max {CAP_LIMITS[row.billing_interval] ?? '-'}</span>,
        sortValue: (row) => CAP_LIMITS[row.billing_interval] ?? 0,
      },
    ],
    [],
  );

  async function handleSave() {
    if (!editingRow) return;
    const discount = parseInt(discountInput, 10);
    const maxDiscounts = parseInt(maxDiscountsInput, 10);
    const capLimit = CAP_LIMITS[editingRow.billing_interval] ?? 365;

    if (!Number.isFinite(discount) || discount < 0) {
      setError('Discount per day must be 0 or greater');
      return;
    }
    if (!Number.isFinite(maxDiscounts) || maxDiscounts < 1 || maxDiscounts > capLimit) {
      setError(`Max discounts for ${editingRow.intervalLabel} must be between 1 and ${capLimit}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await ucatPracticeDayDiscountConfigApi.update(editingRow.id, {
        discount_per_day_cents: discount,
        max_discounts_per_period: maxDiscounts,
      });
      await load();
      setEditingRow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save discount config');
    } finally {
      setSaving(false);
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
        searchPlaceholder="Search practice-day discounts..."
        defaultSort={{ field: 'billing_interval', direction: 'asc' }}
        isLoading={loading}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => setEditingRow(row),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        title={editingRow ? `Edit ${editingRow.intervalLabel} discount` : 'Edit discount'}
        subtitle="Discount amount per qualifying day and maximum discounts for this billing interval."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditingRow(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save discount'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="discount-per-day">Discount per day (cents)</Label>
            <Input
              id="discount-per-day"
              type="number"
              min={0}
              value={discountInput}
              onChange={(event) => setDiscountInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-discounts">Max discounts per period</Label>
            <Input
              id="max-discounts"
              type="number"
              min={1}
              max={editingRow ? CAP_LIMITS[editingRow.billing_interval] : undefined}
              value={maxDiscountsInput}
              onChange={(event) => setMaxDiscountsInput(event.target.value)}
            />
          </div>
        </div>
        {error && editingRow ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </AdminDialogShell>
    </>
  );
}
