'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  SearchableSelect,
  Label,
} from '@altitutor/ui';
import { Edit2 } from 'lucide-react';
import { pricingApi, type BillingPricingRow } from '../api/pricing';
import { AdminDialogShell } from '@/shared/components';

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
] as const;

interface PricingTableProps {
  pricing: BillingPricingRow[];
  onUpdate: () => void;
}

export function PricingTable({ pricing, onUpdate }: PricingTableProps) {
  const [editingPricing, setEditingPricing] = useState<BillingPricingRow | null>(null);
  const [hourlyRateCents, setHourlyRateCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('AUD');
  const [saving, setSaving] = useState(false);

  const handleEdit = (pricingRow: BillingPricingRow) => {
    setEditingPricing(pricingRow);
    setHourlyRateCents(pricingRow.hourly_rate_cents);
    setCurrency(pricingRow.currency);
  };

  const handleSave = async () => {
    if (!editingPricing) return;
    setSaving(true);
    try {
      await pricingApi.updateBillingPricing(editingPricing.billing_type, {
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setEditingPricing(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Billing Type</TableHead>
              <TableHead>Hourly Rate (AUD)</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricing.map((pricingRow) => (
              <TableRow key={pricingRow.billing_type}>
                <TableCell className="font-medium">{pricingRow.billing_type}</TableCell>
                <TableCell>
                  ${(pricingRow.hourly_rate_cents / 100).toFixed(2)}/hour
                </TableCell>
                <TableCell>{pricingRow.currency}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(pricingRow)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminDialogShell
        open={!!editingPricing}
        onClose={() => setEditingPricing(null)}
        title="Edit Pricing"
        subtitle={`Update the hourly rate for ${editingPricing?.billing_type}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingPricing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hourly-rate">Hourly Rate (AUD)</Label>
            <Input
              id="hourly-rate"
              type="number"
              step="0.01"
              value={(hourlyRateCents / 100).toFixed(2)}
              onChange={(e) =>
                setHourlyRateCents(Math.round(Number(e.target.value) * 100))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <SearchableSelect<(typeof CURRENCY_OPTIONS)[number]>
              items={[...CURRENCY_OPTIONS]}
              value={CURRENCY_OPTIONS.find((c) => c.value === currency) ?? CURRENCY_OPTIONS[0]}
              onValueChange={(item) => setCurrency(item?.value ?? 'AUD')}
              getItemLabel={(o) => o.label}
              getItemId={(o) => o.value}
              placeholder="Select currency"
            />
          </div>
        </div>
      </AdminDialogShell>
    </>
  );
}
