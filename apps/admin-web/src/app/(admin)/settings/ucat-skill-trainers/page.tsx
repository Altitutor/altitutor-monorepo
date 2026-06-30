'use client';

import { useState } from 'react';
import { UcatSkillTrainerConfigForm } from '@/features/ucat-skill-trainer-config/components/UcatSkillTrainerConfigForm';
import { AdminDialogShell, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';

type SettingsRow = {
  id: string;
  name: string;
  description: string;
};

const SETTINGS_ROWS: SettingsRow[] = [
  {
    id: 'skill-trainers',
    name: 'Skill trainer config',
    description: 'Enable trainers and configure timing, scoring, and cooldowns.',
  },
];

export default function UcatSkillTrainersSettingsPage() {
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
    <div className="p-6 space-y-6">
      <SettingsPageHeader title="UCAT skill trainers" />
      <SettingsDataTable
        data={SETTINGS_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search UCAT skill trainer settings..."
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
        title={editingRow?.name ?? 'Edit skill trainer config'}
        subtitle={editingRow?.description}
        contentClassName="md:max-w-5xl"
      >
        <UcatSkillTrainerConfigForm />
      </AdminDialogShell>
    </div>
  );
}
