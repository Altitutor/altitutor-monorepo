'use client';

import { useState } from 'react';
import { AdminDialogShell, AdminLoadingSkeleton, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';
import { UcatModelConfigForm } from '@/features/ucat-model-config/components/UcatModelConfigForm';
import { useUcatModelConfig } from '@/features/ucat-model-config/hooks/use-ucat-model-config';
import type { UcatModelConfigWithSection } from '@/features/ucat-model-config/api/ucat-model-config';

export default function UcatModelConfigPage() {
  const { data, isLoading, error } = useUcatModelConfig();
  const [editingRow, setEditingRow] = useState<UcatModelConfigWithSection | null>(null);

  if (isLoading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  const rows = data ?? [];
  const columns: SettingsDataTableColumn<UcatModelConfigWithSection>[] = [
    {
      key: 'section',
      label: 'Section',
      render: (row) => <span className="font-medium">{row.sectionName}</span>,
      sortValue: (row) => row.sectionNumber,
      searchValue: (row) => row.sectionName,
    },
    {
      key: 'k_prior',
      label: 'Learning rate prior',
      render: (row) => row.k_prior,
      sortValue: (row) => row.k_prior,
      searchValue: (row) => String(row.k_prior),
    },
    {
      key: 's_inf_uplift',
      label: 'Ceiling uplift',
      render: (row) => row.s_inf_uplift,
      sortValue: (row) => row.s_inf_uplift,
      searchValue: (row) => String(row.s_inf_uplift),
    },
    {
      key: 'r_noise',
      label: 'Measurement noise',
      render: (row) => row.r_noise,
      sortValue: (row) => row.r_noise,
      searchValue: (row) => String(row.r_noise),
    },
    {
      key: 'p0',
      label: 'Initial uncertainty',
      render: (row) => row.p0,
      sortValue: (row) => row.p0,
      searchValue: (row) => String(row.p0),
    },
  ];

  return (
    <div className="p-6">
      <SettingsPageHeader title="UCAT model config" />

      {error ? <p className="mb-4 text-sm text-destructive">{error.message}</p> : null}

      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage="No UCAT model config rows found"
        searchPlaceholder="Search UCAT model config..."
        filterKeys={[]}
        defaultSort={{ field: 'section', direction: 'asc' }}
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
        title={editingRow?.sectionName ?? 'Edit UCAT model config'}
        subtitle={editingRow ? `Section ${editingRow.sectionNumber} cold-start constants` : undefined}
        contentClassName="md:max-w-3xl"
      >
        {editingRow ? <UcatModelConfigForm initial={editingRow} /> : null}
      </AdminDialogShell>
    </div>
  );
}
