'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@altitutor/ui';
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

type EditableRow = UcatPracticeDayDiscountConfigRow & {
  discountInput: string;
  maxDiscountsInput: string;
};

function toEditable(row: UcatPracticeDayDiscountConfigRow): EditableRow {
  return {
    ...row,
    discountInput: String(row.discount_per_day_cents),
    maxDiscountsInput: String(row.max_discounts_per_period),
  };
}

export function UcatPracticeDayDiscountForm() {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSaveRow = async (row: EditableRow) => {
    const discount = parseInt(row.discountInput, 10);
    const maxDiscounts = parseInt(row.maxDiscountsInput, 10);
    const capLimit = CAP_LIMITS[row.billing_interval] ?? 365;

    if (!Number.isFinite(discount) || discount < 0) {
      setError('Discount per day (cents) must be 0 or greater');
      return;
    }
    if (!Number.isFinite(maxDiscounts) || maxDiscounts < 1 || maxDiscounts > capLimit) {
      setError(`Max discounts for ${INTERVAL_LABELS[row.billing_interval] ?? row.billing_interval} must be between 1 and ${capLimit}`);
      return;
    }

    setSavingId(row.id);
    setError(null);
    try {
      await ucatPracticeDayDiscountConfigApi.update(row.id, {
        discount_per_day_cents: discount,
        max_discounts_per_period: maxDiscounts,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? toEditable({
                ...r,
                discount_per_day_cents: discount,
                max_discounts_per_period: maxDiscounts,
              })
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save discount config');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading practice-day discounts…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice-day discounts</CardTitle>
        <CardDescription>
          Discount amount per qualifying day and maximum discounts per billing period,
          configured per interval (shared across Unlimited and Pro).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <div>
              <p className="text-sm font-semibold">
                {INTERVAL_LABELS[row.billing_interval] ?? row.billing_interval}
              </p>
              <p className="text-xs text-muted-foreground">
                Cap max {CAP_LIMITS[row.billing_interval] ?? '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`discount-${row.id}`}>Discount per day (cents)</Label>
              <Input
                id={`discount-${row.id}`}
                type="number"
                min={0}
                value={row.discountInput}
                onChange={(e) => updateRow(row.id, { discountInput: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`max-${row.id}`}>Max discounts per period</Label>
              <Input
                id={`max-${row.id}`}
                type="number"
                min={1}
                max={CAP_LIMITS[row.billing_interval]}
                value={row.maxDiscountsInput}
                onChange={(e) => updateRow(row.id, { maxDiscountsInput: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                disabled={savingId === row.id}
                onClick={() => void handleSaveRow(row)}
              >
                {savingId === row.id ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ))}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
