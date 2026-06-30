'use client';

import { useState } from 'react';
import { BillingPolicyEditor } from '@/features/policies/components/BillingPolicyEditor';
import { AdminDialogShell, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';

type PolicySettingsRow = {
  id: string;
  name: string;
  description: string;
};

const POLICY_ROWS: PolicySettingsRow[] = [
  {
    id: 'billing_policy',
    name: 'Billing Policy',
    description: 'Policy shown to students during registration before payment method setup.',
  },
];

export default function PoliciesPage() {
  const [editingPolicy, setEditingPolicy] = useState<PolicySettingsRow | null>(null);

  const columns: SettingsDataTableColumn<PolicySettingsRow>[] = [
    {
      key: 'name',
      label: 'Policy',
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
      <SettingsPageHeader title="Policies" />

      <SettingsDataTable
        data={POLICY_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        filterKeys={[]}
        searchPlaceholder="Search policies..."
        defaultSort={{ field: 'name', direction: 'asc' }}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => setEditingPolicy(row),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingPolicy}
        onClose={() => setEditingPolicy(null)}
        title={editingPolicy?.name ?? 'Edit Policy'}
        subtitle={editingPolicy?.description}
        contentClassName="md:max-w-5xl"
      >
        <BillingPolicyEditor />
      </AdminDialogShell>
    </div>
  );
}
