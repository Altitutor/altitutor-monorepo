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

type EditableRow = UcatPlanPriceRow & {
  basePriceInput: string;
  stripePriceInput: string;
};

function toEditable(row: UcatPlanPriceRow): EditableRow {
  return {
    ...row,
    basePriceInput: String(row.base_price_cents),
    stripePriceInput: row.stripe_price_id ?? '',
  };
}

export function UcatPlanPricesForm() {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSaveRow = async (row: EditableRow) => {
    const base = parseInt(row.basePriceInput, 10);
    if (!Number.isFinite(base) || base < 0) {
      setError('Base price (cents) must be 0 or greater');
      return;
    }
    setSavingId(row.id);
    setError(null);
    try {
      await ucatPlanPricesApi.update(row.id, {
        base_price_cents: base,
        stripe_price_id: row.stripePriceInput.trim() || null,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan price');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading plan prices…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan prices</CardTitle>
        <CardDescription>
          List price and Stripe price ID for each paid tier and billing interval. Checkout is
          enabled when the tier&apos;s Stripe product ID is set and the interval has a price ID.
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
                {TIER_LABELS[row.plan_tier] ?? row.plan_tier}
              </p>
              <p className="text-xs text-muted-foreground">
                {INTERVAL_LABELS[row.billing_interval] ?? row.billing_interval}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`base-${row.id}`}>Base price (cents)</Label>
              <Input
                id={`base-${row.id}`}
                type="number"
                min={0}
                value={row.basePriceInput}
                onChange={(e) => updateRow(row.id, { basePriceInput: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`price-${row.id}`}>Stripe price ID</Label>
              <Input
                id={`price-${row.id}`}
                value={row.stripePriceInput}
                onChange={(e) => updateRow(row.id, { stripePriceInput: e.target.value })}
                placeholder="price_..."
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
