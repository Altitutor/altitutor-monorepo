'use client';

import { useState } from 'react';
import { UcatGenerationSettingsPage } from '@/features/ucat-generation-settings/components/UcatGenerationSettingsPage';
import { AdminDialogShell, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';

type SettingsRow = {
  id: string;
  name: string;
  description: string;
};

const SETTINGS_ROWS: SettingsRow[] = [
  {
    id: 'ucat-generation',
    name: 'UCAT generation',
    description: 'Configure AI providers, model profiles, prompts, budgets, and run limits.',
  },
];

export default function UcatGenerationSettingsRoute() {
  const [editingRow, setEditingRow] = useState<SettingsRow | null>(null);

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
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT generation" />
      <SettingsDataTable
        data={SETTINGS_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search UCAT generation settings..."
        defaultSort={{ field: 'name', direction: 'asc' }}
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
        title={editingRow?.name ?? 'UCAT generation'}
        subtitle={editingRow?.description}
        contentClassName="md:max-w-6xl"
      >
        <UcatGenerationSettingsPage />
      </AdminDialogShell>
    </div>
  );
}
