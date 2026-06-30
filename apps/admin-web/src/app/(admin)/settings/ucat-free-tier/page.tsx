'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminDialogShell, AdminLoadingSkeleton, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatFreeQuotaConfigForm } from '@/features/ucat-subscription-config/components/UcatFreeQuotaConfigForm';

type SettingsRow = {
  id: string;
  name: string;
  description: string;
};

const SETTINGS_ROWS: SettingsRow[] = [
  {
    id: 'free-tier-quotas',
    name: 'Free tier quotas',
    description: 'Per-area usage limits for UCAT Free students.',
  },
];

export default function UcatFreeTierSettingsPage() {
  const [config, setConfig] = useState<UcatSubscriptionConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SettingsRow | null>(null);

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
    return <AdminLoadingSkeleton variant="table" />;
  }

  const columns: SettingsDataTableColumn<SettingsRow>[] = [
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

  return (
    <div className="p-6">
      <SettingsPageHeader title="UCAT Free tier" />

      {loadError && !config ? (
        <p className="mb-4 text-sm text-destructive">{loadError}</p>
      ) : null}

      <SettingsDataTable
        data={SETTINGS_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search UCAT Free tier settings..."
        defaultSort={{ field: 'name', direction: 'asc' }}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            disabled: !config,
            onSelect: () => setEditingRow(row),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        title={editingRow?.name ?? 'Edit UCAT Free tier'}
        subtitle={editingRow?.description}
        contentClassName="md:max-w-4xl"
      >
        {config ? <UcatFreeQuotaConfigForm initial={config} onSaved={load} /> : null}
      </AdminDialogShell>
    </div>
  );
}
