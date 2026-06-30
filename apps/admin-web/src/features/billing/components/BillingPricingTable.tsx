'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
  SearchableSelect,
} from '@altitutor/ui';
import { pricingApi, type BillingPricingRow } from '../api/pricing';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface BillingPricingTableProps {
  pricing: BillingPricingRow[];
  onUpdate: () => void;
}

export function BillingPricingTable({ pricing, onUpdate }: BillingPricingTableProps) {
  const [editingPricing, setEditingPricing] = useState<BillingPricingRow | null>(null);
  const [hourlyRateCents, setHourlyRateCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('AUD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingPricing) setHourlyRateCents(0);
  }, [editingPricing]);

  const handleEdit = (p: BillingPricingRow) => {
    setEditingPricing(p);
    setHourlyRateCents(p.hourly_rate_cents);
    setCurrency(p.currency);
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

  const formatBillingType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const columns: SettingsDataTableColumn<BillingPricingRow>[] = [
    {
      key: 'billing_type',
      label: 'Billing Type',
      render: (pricingRow) => <span className="font-medium">{formatBillingType(pricingRow.billing_type)}</span>,
      sortValue: (pricingRow) => formatBillingType(pricingRow.billing_type),
      filterValue: (pricingRow) => pricingRow.billing_type,
      searchValue: (pricingRow) => formatBillingType(pricingRow.billing_type),
    },
    {
      key: 'hourly_rate',
      label: 'Hourly Rate',
      render: (pricingRow) => `$${(pricingRow.hourly_rate_cents / 100).toFixed(2)}/hour`,
      sortValue: (pricingRow) => pricingRow.hourly_rate_cents,
      searchValue: (pricingRow) => String(pricingRow.hourly_rate_cents / 100),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (pricingRow) => pricingRow.currency,
      sortValue: (pricingRow) => pricingRow.currency,
      filterValue: (pricingRow) => pricingRow.currency,
      searchValue: (pricingRow) => pricingRow.currency,
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={pricing}
        columns={columns}
        getRowId={(pricingRow) => pricingRow.billing_type}
        emptyMessage="No billing pricing configured"
        searchPlaceholder="Search billing pricing..."
        filterKeys={['billing_type', 'currency']}
        filterDefinitions={[
          {
            key: 'billing_type',
            label: 'Billing Type',
            options: pricing.map((pricingRow) => ({
              label: formatBillingType(pricingRow.billing_type),
              value: pricingRow.billing_type,
            })),
          },
          {
            key: 'currency',
            label: 'Currency',
            options: Array.from(new Set(pricing.map((pricingRow) => pricingRow.currency))).map((value) => ({
              label: value,
              value,
            })),
          },
        ]}
        defaultSort={{ field: 'billing_type', direction: 'asc' }}
        getActions={(pricingRow) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => handleEdit(pricingRow),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingPricing}
        onClose={() => setEditingPricing(null)}
        title="Edit Billing Pricing"
        subtitle={editingPricing ? `Update the hourly rate for ${formatBillingType(editingPricing.billing_type)}` : undefined}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingPricing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        )}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hourly-rate">Hourly Rate</Label>
              <Input
                id="edit-hourly-rate"
                type="number"
                step="0.01"
                value={(hourlyRateCents / 100).toFixed(2)}
                onChange={(e) =>
                  setHourlyRateCents(Math.round(Number(e.target.value) * 100))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <SearchableSelect<{ id: string; label: string }>
                items={[
                  { id: 'AUD', label: 'AUD' },
                  { id: 'USD', label: 'USD' },
                ]}
                value={currency ? { id: currency, label: currency } : null}
                onValueChange={(v) => v && setCurrency(v.id)}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.label}
                placeholder="Select currency"
                trigger={
                  <Button variant="outline" className="w-full justify-start font-normal" id="edit-currency">
                    {currency || 'Select currency'}
                  </Button>
                }
              />
            </div>
          </div>
      </AdminDialogShell>
    </>
  );
}
