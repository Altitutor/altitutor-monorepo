'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminDialogShell, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatSubscriptionConfigForm } from '@/features/ucat-subscription-config/components/UcatSubscriptionConfigForm';
import { UcatPlanPricesForm } from '@/features/ucat-subscription-config/components/UcatPlanPricesForm';
import { UcatPracticeDayDiscountForm } from '@/features/ucat-subscription-config/components/UcatPracticeDayDiscountForm';

type SubscriptionSettingsRow = {
  id: 'subscription' | 'discounts' | 'prices';
  name: string;
  description: string;
};

const SETTINGS_ROWS: SubscriptionSettingsRow[] = [
  {
    id: 'subscription',
    name: 'Subscription config',
    description: 'Pro trial, weekly and monthly pricing, and Stripe price IDs.',
  },
  {
    id: 'discounts',
    name: 'Practice day discount',
    description: 'Configure practice-day discounts.',
  },
  {
    id: 'prices',
    name: 'Plan prices',
    description: 'Configure UCAT plan price records.',
  },
];

export default function UcatSubscriptionSettingsPage() {
  const [config, setConfig] = useState<UcatSubscriptionConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SubscriptionSettingsRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const row = await ucatSubscriptionConfigApi.getSingleton();
      setConfig(row);
      if (!row) {
        setLoadError('No UCAT subscription config row found. Apply migrations and ensure the seed ran.');
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load config');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const columns: SettingsDataTableColumn<SubscriptionSettingsRow>[] = [
    {
      key: 'name',
      label: 'Setting',
      render: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
      searchValue: (row) => row.name,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => <span className="text-muted-foreground">{row.description}</span>,
      sortValue: (row) => row.description,
      searchValue: (row) => row.description,
    },
  ];

  const renderEditor = () => {
    if (!editingRow) return null;
    if (editingRow.id === 'subscription') {
      return config ? <UcatSubscriptionConfigForm initial={config} onSaved={load} /> : null;
    }
    if (editingRow.id === 'discounts') {
      return <UcatPracticeDayDiscountForm />;
    }
    return <UcatPlanPricesForm />;
  };

  return (
    <div className="p-6 space-y-6">
      <SettingsPageHeader title="UCAT subscription" />

      {loadError && !config ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <SettingsDataTable
        data={SETTINGS_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search UCAT subscription settings..."
        defaultSort={{ field: 'name', direction: 'asc' }}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            disabled: row.id === 'subscription' && !config,
            onSelect: () => setEditingRow(row),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        title={editingRow?.name ?? 'Edit UCAT subscription'}
        subtitle={editingRow?.description}
        contentClassName="md:max-w-5xl"
      >
        {renderEditor()}
      </AdminDialogShell>
    </div>
  );
}
