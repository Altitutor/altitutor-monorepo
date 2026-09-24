'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  SearchableSelect,
  Label,
} from '@altitutor/ui';
import { subjectPricingOverridesApi, type SubjectPricingOverrideRow } from '../api/subject-pricing-overrides';
import { subjectsApi } from '@/features/subjects/api/subjects';
import type { Tables } from '@altitutor/shared';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

const BILLING_TYPE_OPTIONS: { value: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING'; label: string }[] = [
  { value: 'CLASS', label: 'CLASS' },
  { value: 'EXAM_COURSE', label: 'EXAM_COURSE' },
  { value: 'DRAFTING', label: 'DRAFTING' },
];

interface SubjectPricingOverridesTableProps {
  overrides: SubjectPricingOverrideRow[];
  onUpdate: () => void;
  onCreateTrigger?: number;
}

export function SubjectPricingOverridesTable({ overrides, onUpdate, onCreateTrigger }: SubjectPricingOverridesTableProps) {
  const [editingOverride, setEditingOverride] = useState<SubjectPricingOverrideRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [hourlyRateCents, setHourlyRateCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('AUD');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedBillingType, setSelectedBillingType] = useState<'CLASS' | 'EXAM_COURSE' | 'DRAFTING'>('CLASS');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Load subjects for dropdown
  const loadSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const data = await subjectsApi.getAllSubjects();
      setSubjects(data);
    } catch (e) {
      alert('Failed to load subjects: ' + (e as Error).message);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleEdit = (override: SubjectPricingOverrideRow) => {
    setEditingOverride(override);
    setHourlyRateCents(override.hourly_rate_cents);
    setCurrency(override.currency);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedSubjectId('');
    setSelectedBillingType('CLASS');
    setHourlyRateCents(0);
    setCurrency('AUD');
    loadSubjects();
  };

  const handleSave = async () => {
    if (!editingOverride) return;
    setSaving(true);
    try {
      await subjectPricingOverridesApi.updateSubjectOverride(editingOverride.id, {
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setEditingOverride(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSave = async () => {
    if (!selectedSubjectId) {
      alert('Please select a subject');
      return;
    }
    setSaving(true);
    try {
      await subjectPricingOverridesApi.createSubjectOverride({
        subject_id: selectedSubjectId,
        billing_type: selectedBillingType,
        hourly_rate_cents: hourlyRateCents,
        currency,
      });
      setIsCreating(false);
      onUpdate();
    } catch (e) {
      alert('Failed to create: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return;
    setDeleting(overrideId);
    try {
      await subjectPricingOverridesApi.deleteSubjectOverride(overrideId);
      onUpdate();
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const formatSubjectName = (subject: SubjectPricingOverrideRow['subject']): string => {
    const parts: string[] = [];
    if (subject.curriculum) parts.push(subject.curriculum);
    if (subject.year_level != null) parts.push(`Year ${subject.year_level}`);
    parts.push(subject.name);
    return parts.join(' ');
  };

  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      handleCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateTrigger]);

  const columns: SettingsDataTableColumn<SubjectPricingOverrideRow>[] = [
    {
      key: 'subject',
      label: 'Subject',
      render: (override) => <span className="font-medium">{formatSubjectName(override.subject)}</span>,
      sortValue: (override) => formatSubjectName(override.subject),
      searchValue: (override) => formatSubjectName(override.subject),
    },
    {
      key: 'billing_type',
      label: 'Billing Type',
      render: (override) => override.billing_type,
      sortValue: (override) => override.billing_type,
      filterValue: (override) => override.billing_type,
      searchValue: (override) => override.billing_type,
    },
    {
      key: 'hourly_rate',
      label: 'Hourly Rate (AUD)',
      render: (override) => `$${(override.hourly_rate_cents / 100).toFixed(2)}/hour`,
      sortValue: (override) => override.hourly_rate_cents,
      searchValue: (override) => String(override.hourly_rate_cents / 100),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (override) => override.currency,
      sortValue: (override) => override.currency,
      filterValue: (override) => override.currency,
      searchValue: (override) => override.currency,
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={overrides}
        columns={columns}
        getRowId={(override) => override.id}
        emptyMessage="No subject pricing overrides yet"
        searchPlaceholder="Search by subject name or billing type..."
        filterKeys={['billing_type', 'currency']}
        filterDefinitions={[
          {
            key: 'billing_type',
            label: 'Billing Type',
            options: BILLING_TYPE_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
          },
          {
            key: 'currency',
            label: 'Currency',
            options: Array.from(new Set(overrides.map((override) => override.currency))).map((value) => ({
              label: value,
              value,
            })),
          },
        ]}
        defaultSort={{ field: 'subject', direction: 'asc' }}
        getActions={(override) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => handleEdit(override),
          },
          {
            id: 'delete',
            label: 'Delete',
            disabled: deleting === override.id,
            onSelect: () => handleDelete(override.id),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingOverride}
        onClose={() => setEditingOverride(null)}
        title="Edit Pricing Override"
        subtitle={editingOverride ? `Update the hourly rate override for ${formatSubjectName(editingOverride.subject)} (${editingOverride.billing_type})` : undefined}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingOverride(null)}>
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
              <Label htmlFor="edit-hourly-rate">Hourly Rate (AUD)</Label>
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
              <SearchableSelect<string>
                items={['AUD', 'USD']}
                value={currency}
                onValueChange={(v) => v && setCurrency(v)}
                getItemLabel={(v) => v}
                getItemId={(v) => v}
              />
            </div>
          </div>
      </AdminDialogShell>

      <AdminDialogShell
        open={isCreating}
        onClose={() => setIsCreating(false)}
        title="Create Pricing Override"
        subtitle="Create a subject-specific hourly rate override"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSave} disabled={saving || !selectedSubjectId}>
              {saving ? 'Creating...' : 'Create Override'}
            </Button>
          </>
        )}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-subject">Subject</Label>
              <SearchableSelect<Tables<'subjects'>>
                items={subjects}
                value={subjects.find((s) => s.id === selectedSubjectId) ?? null}
                onValueChange={(item) => item && setSelectedSubjectId(item.id)}
                getItemLabel={(s) =>
                  [s.curriculum, s.year_level ? `Year ${s.year_level}` : null, s.name]
                    .filter(Boolean)
                    .join(' ')
                }
                getItemId={(s) => s.id}
                placeholder={loadingSubjects ? 'Loading subjects...' : 'Select a subject'}
                disabled={loadingSubjects}
                loading={loadingSubjects}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-billing-type">Billing Type</Label>
              <SearchableSelect<(typeof BILLING_TYPE_OPTIONS)[number]>
                items={BILLING_TYPE_OPTIONS}
                value={BILLING_TYPE_OPTIONS.find((i) => i.value === selectedBillingType) ?? null}
                onValueChange={(item) => item && setSelectedBillingType(item.value)}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-hourly-rate">Hourly Rate (AUD)</Label>
              <Input
                id="create-hourly-rate"
                type="number"
                step="0.01"
                value={(hourlyRateCents / 100).toFixed(2)}
                onChange={(e) =>
                  setHourlyRateCents(Math.round(Number(e.target.value) * 100))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-currency">Currency</Label>
              <SearchableSelect<string>
                items={['AUD', 'USD']}
                value={currency}
                onValueChange={(v) => v && setCurrency(v)}
                getItemLabel={(v) => v}
                getItemId={(v) => v}
              />
            </div>
          </div>
      </AdminDialogShell>
    </>
  );
}
