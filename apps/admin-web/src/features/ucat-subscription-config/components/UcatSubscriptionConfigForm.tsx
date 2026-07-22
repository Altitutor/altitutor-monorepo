'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
} from '@altitutor/ui';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
  type UcatSubscriptionConfigUpdate,
} from '../api/ucat-subscription-config';

type SubscriptionSettingKey =
  | 'trial_days'
  | 'currency'
  | 'min_questions_per_day'
  | 'unlimited_stripe_product_id';

type SubscriptionSettingRow = {
  key: SubscriptionSettingKey;
  label: string;
  value: string;
  rawValue: string;
  description: string;
  inputType: 'number' | 'text';
  placeholder?: string;
};

interface UcatSubscriptionConfigFormProps {
  initial: UcatSubscriptionConfigRow;
  onSaved: () => void;
}

function buildRows(initial: UcatSubscriptionConfigRow): SubscriptionSettingRow[] {
  return [
    {
      key: 'trial_days',
      label: 'Standard Unlimited trial days',
      value: String(initial.trial_days),
      rawValue: String(initial.trial_days),
      description: 'Trial length for eligible first-time students without a referral gift. Set to 0 to disable.',
      inputType: 'number',
    },
    {
      key: 'currency',
      label: 'Currency code',
      value: initial.currency,
      rawValue: initial.currency,
      description: 'Short currency code used for UCAT billing amounts.',
      inputType: 'text',
      placeholder: 'aud',
    },
    {
      key: 'min_questions_per_day',
      label: 'Min questions per day',
      value: String(initial.min_questions_per_day),
      rawValue: String(initial.min_questions_per_day),
      description: 'Global practice-day qualification threshold for discounts.',
      inputType: 'number',
    },
    {
      key: 'unlimited_stripe_product_id',
      label: 'Unlimited Stripe product ID',
      value: initial.unlimited_stripe_product_id || 'Not set',
      rawValue: initial.unlimited_stripe_product_id ?? '',
      description: 'Stripe product used for UCAT Unlimited checkout.',
      inputType: 'text',
      placeholder: 'prod_...',
    },
  ];
}

export function UcatSubscriptionConfigForm({ initial, onSaved }: UcatSubscriptionConfigFormProps) {
  const [editingRow, setEditingRow] = useState<SubscriptionSettingRow | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(initial), [initial]);

  useEffect(() => {
    if (!editingRow) return;
    setValue(editingRow.rawValue);
    setError(null);
  }, [editingRow]);

  const columns = useMemo<SettingsDataTableColumn<SubscriptionSettingRow>[]>(
    () => [
      {
        key: 'label',
        label: 'Setting',
        render: (row) => <span className="font-medium">{row.label}</span>,
        sortValue: (row) => row.label,
        searchValue: (row) => `${row.label} ${row.description}`,
      },
      {
        key: 'value',
        label: 'Value',
        render: (row) => <span className="font-mono text-sm">{row.value}</span>,
        sortValue: (row) => row.value,
      },
      {
        key: 'description',
        label: 'Description',
        render: (row) => <span className="text-muted-foreground">{row.description}</span>,
        sortValue: (row) => row.description,
        searchValue: (row) => row.description,
      },
    ],
    [],
  );

  async function handleSave() {
    if (!editingRow) return;
    setError(null);

    const updates: UcatSubscriptionConfigUpdate = {};
    if (editingRow.key === 'trial_days') {
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 730) {
        setError('Trial days must be between 0 and 730');
        return;
      }
      updates.trial_days = parsed;
    } else if (editingRow.key === 'min_questions_per_day') {
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setError('Min questions per day must be at least 1');
        return;
      }
      updates.min_questions_per_day = parsed;
    } else if (editingRow.key === 'currency') {
      const currency = value.trim().toLowerCase();
      if (!currency || currency.length > 8) {
        setError('Currency must be a short code, for example aud');
        return;
      }
      updates.currency = currency;
    } else {
      updates.unlimited_stripe_product_id = value.trim() || null;
    }

    setSaving(true);
    try {
      await ucatSubscriptionConfigApi.update(initial.id, updates);
      await Promise.resolve(onSaved());
      setEditingRow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.key}
        filterKeys={[]}
        searchPlaceholder="Search subscription settings..."
        defaultSort={{ field: 'label', direction: 'asc' }}
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
        title={editingRow ? `Edit ${editingRow.label}` : 'Edit subscription setting'}
        subtitle={editingRow?.description}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditingRow(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save setting'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="subscription-setting-value">Value</Label>
          <Input
            id="subscription-setting-value"
            type={editingRow?.inputType ?? 'text'}
            min={editingRow?.inputType === 'number' ? 0 : undefined}
            max={editingRow?.key === 'trial_days' ? 730 : undefined}
            value={value}
            placeholder={editingRow?.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </AdminDialogShell>
    </>
  );
}
