'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import {
  ucatSubscriptionConfigApi,
  type UcatQuotaPeriod,
  type UcatSubscriptionConfigRow,
} from '../api/ucat-subscription-config';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

const QUOTA_PERIODS = ['day', 'week', 'month'] as const;

function isQuotaPeriod(v: string): v is UcatQuotaPeriod {
  return (QUOTA_PERIODS as readonly string[]).includes(v);
}

const FREE_QUOTA_AREAS = [
  {
    key: 'practice',
    label: 'Practice',
    description: 'Unique questions submitted (not set/mock attempts)',
    limitKey: 'free_practice_limit',
    periodKey: 'free_practice_period',
  },
  {
    key: 'sets',
    label: 'Sets',
    description: 'Standalone set attempts started (not sets within a mock)',
    limitKey: 'free_sets_limit',
    periodKey: 'free_sets_period',
  },
  {
    key: 'mocks',
    label: 'Mocks',
    description: 'Mock exam attempts started',
    limitKey: 'free_mocks_limit',
    periodKey: 'free_mocks_period',
  },
  {
    key: 'learn',
    label: 'Learn',
    description: 'Learning modules started',
    limitKey: 'free_learn_limit',
    periodKey: 'free_learn_period',
  },
  {
    key: 'skill_trainer',
    label: 'Skill trainer',
    description: 'Skill trainer sessions started',
    limitKey: 'free_skill_trainer_limit',
    periodKey: 'free_skill_trainer_period',
  },
] as const;

type FreeQuotaLimitKey = (typeof FREE_QUOTA_AREAS)[number]['limitKey'];
type FreeQuotaPeriodKey = (typeof FREE_QUOTA_AREAS)[number]['periodKey'];
type FreeQuotaArea = (typeof FREE_QUOTA_AREAS)[number];

type FreeQuotaRow = FreeQuotaArea & {
  limit: number;
  period: UcatQuotaPeriod;
  status: 'Enabled' | 'Disabled';
};

function getQuotaLimit(row: UcatSubscriptionConfigRow, key: FreeQuotaLimitKey): number {
  return row[key] ?? 0;
}

function getQuotaPeriod(row: UcatSubscriptionConfigRow, key: FreeQuotaPeriodKey): UcatQuotaPeriod {
  const value = row[key];
  return isQuotaPeriod(value) ? value : 'day';
}

interface UcatFreeQuotaConfigFormProps {
  initial: UcatSubscriptionConfigRow;
  onSaved: () => void;
}

export function UcatFreeQuotaConfigForm({ initial, onSaved }: UcatFreeQuotaConfigFormProps) {
  const [editingArea, setEditingArea] = useState<FreeQuotaRow | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [periodInput, setPeriodInput] = useState<UcatQuotaPeriod>('day');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<FreeQuotaRow[]>(
    () =>
      FREE_QUOTA_AREAS.map((area) => {
        const limit = getQuotaLimit(initial, area.limitKey);
        return {
          ...area,
          limit,
          period: getQuotaPeriod(initial, area.periodKey),
          status: limit === 0 ? 'Disabled' : 'Enabled',
        };
      }),
    [initial],
  );

  useEffect(() => {
    if (!editingArea) return;
    setLimitInput(String(editingArea.limit));
    setPeriodInput(editingArea.period);
    setError(null);
  }, [editingArea]);

  const columns = useMemo<SettingsDataTableColumn<FreeQuotaRow>[]>(
    () => [
      {
        key: 'label',
        label: 'Quota',
        render: (row) => <span className="font-medium">{row.label}</span>,
        sortValue: (row) => row.label,
        searchValue: (row) => `${row.label} ${row.description}`,
      },
      {
        key: 'limit',
        label: 'Limit',
        render: (row) => <span className="font-mono tabular-nums">{row.limit}</span>,
        sortValue: (row) => row.limit,
      },
      {
        key: 'period',
        label: 'Per',
        render: (row) => <span className="capitalize">{row.period}</span>,
        sortValue: (row) => row.period,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <span className={row.status === 'Disabled' ? 'text-muted-foreground' : undefined}>{row.status}</span>,
        sortValue: (row) => row.status,
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

  const handleSave = async () => {
    if (!editingArea) return;
    setError(null);

    const limit = parseInt(limitInput, 10);
    if (!Number.isFinite(limit) || limit < 0) {
      setError(`${editingArea.label}: limit must be 0 or greater`);
      return;
    }

    setSaving(true);
    try {
      await ucatSubscriptionConfigApi.update(initial.id, {
        [editingArea.limitKey]: limit,
        [editingArea.periodKey]: periodInput,
      });
      await Promise.resolve(onSaved());
      setEditingArea(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <SettingsDataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.key}
          filterKeys={[]}
          searchPlaceholder="Search Free tier limits..."
          defaultSort={{ field: 'label', direction: 'asc' }}
          getActions={(row) => [
            {
              id: 'edit',
              label: 'Edit',
              onSelect: () => setEditingArea(row),
            },
          ]}
        />
      </div>
      <AdminDialogShell
        open={!!editingArea}
        onClose={() => setEditingArea(null)}
        title={editingArea ? `Edit ${editingArea.label}` : 'Edit Free tier limit'}
        subtitle="Set limit to 0 to disable this area for UCAT Free students. Period boundaries use each student's timezone."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditingArea(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save limit'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="free-tier-limit">Limit</Label>
            <Input
              id="free-tier-limit"
              type="number"
              min={0}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="free-tier-period">Per</Label>
            <Select
              value={periodInput}
              onValueChange={(value) => {
                if (isQuotaPeriod(value)) setPeriodInput(value);
              }}
            >
              <SelectTrigger id="free-tier-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </AdminDialogShell>
    </>
  );
}
