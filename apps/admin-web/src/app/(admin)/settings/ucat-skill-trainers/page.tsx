'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@altitutor/ui';
import {
  ucatSkillTrainerConfigApi,
  type UcatSkillTrainerConfigRow,
} from '@/features/ucat-skill-trainer-config/api/ucat-skill-trainer-config';
import { UcatSkillTrainerConfigForm } from '@/features/ucat-skill-trainer-config/components/UcatSkillTrainerConfigForm';
import { AdminDialogShell, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';

type SettingsRow = Awaited<ReturnType<typeof ucatSkillTrainerConfigApi.list>>[number];

function formatSpeedBonus(config: UcatSkillTrainerConfigRow | null) {
  if (!config?.speed_bonus_enabled) return 'Off';
  return `Up to ${config.speed_bonus_max_points} pts under ${config.speed_bonus_window_seconds}s`;
}

export default function UcatSkillTrainersSettingsPage() {
  const [editingRow, setEditingRow] = useState<SettingsRow | null>(null);
  const [rows, setRows] = useState<SettingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRows() {
    setError(null);
    setLoading(true);
    try {
      setRows(await ucatSkillTrainerConfigApi.list());
    } catch {
      setError('Failed to load UCAT skill trainers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const columns: SettingsDataTableColumn<SettingsRow>[] = [
    {
      key: 'name',
      label: 'Skill trainer',
      render: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
      searchValue: (row) => row.name,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => <span className="text-muted-foreground">{row.description}</span>,
      sortValue: (row) => row.description,
      searchValue: (row) => row.description ?? '',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.is_enabled ? 'default' : 'secondary'}>
          {row.is_enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
      sortValue: (row) => (row.is_enabled ? 'Enabled' : 'Disabled'),
      searchValue: (row) => (row.is_enabled ? 'Enabled' : 'Disabled'),
    },
    {
      key: 'time_limit',
      label: 'Time limit',
      render: (row) => `${row.config?.time_limit_seconds ?? 60}s`,
      sortValue: (row) => row.config?.time_limit_seconds ?? 60,
    },
    {
      key: 'speed_bonus',
      label: 'Speed bonus',
      render: (row) => <span className="text-muted-foreground">{formatSpeedBonus(row.config)}</span>,
      sortValue: (row) => formatSpeedBonus(row.config),
      searchValue: (row) => formatSpeedBonus(row.config),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <SettingsPageHeader title="UCAT skill trainers" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search UCAT skill trainer settings..."
        defaultSort={{ field: 'name', direction: 'asc' }}
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
        title={editingRow?.name ?? 'Edit skill trainer config'}
        subtitle={editingRow?.description ?? undefined}
        contentClassName="md:max-w-5xl"
      >
        <UcatSkillTrainerConfigForm trainer={editingRow} onSaved={() => void loadRows()} />
      </AdminDialogShell>
    </div>
  );
}
