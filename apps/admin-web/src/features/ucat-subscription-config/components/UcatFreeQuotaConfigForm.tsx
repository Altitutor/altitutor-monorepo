'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  const [freeQuotas, setFreeQuotas] = useState(() =>
    Object.fromEntries(
      FREE_QUOTA_AREAS.map((area) => [
        area.key,
        {
          limit: String(getQuotaLimit(initial, area.limitKey)),
          period: getQuotaPeriod(initial, area.periodKey),
        },
      ]),
    ) as Record<string, { limit: string; period: UcatQuotaPeriod }>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFreeQuotas(
      Object.fromEntries(
        FREE_QUOTA_AREAS.map((area) => [
          area.key,
          {
            limit: String(getQuotaLimit(initial, area.limitKey)),
            period: getQuotaPeriod(initial, area.periodKey),
          },
        ]),
      ) as Record<string, { limit: string; period: UcatQuotaPeriod }>,
    );
  }, [initial]);

  const handleSave = async () => {
    setError(null);

    const quotaPayload: Partial<UcatSubscriptionConfigRow> = {};
    for (const area of FREE_QUOTA_AREAS) {
      const entry = freeQuotas[area.key];
      const limit = parseInt(entry?.limit ?? '0', 10);
      if (!Number.isFinite(limit) || limit < 0) {
        setError(`${area.label}: limit must be 0 or greater`);
        return;
      }
      quotaPayload[area.limitKey] = limit;
      quotaPayload[area.periodKey] = entry?.period ?? 'day';
    }

    setSaving(true);
    try {
      await ucatSubscriptionConfigApi.update(initial.id, {
        free_practice_limit: quotaPayload.free_practice_limit!,
        free_practice_period: quotaPayload.free_practice_period!,
        free_sets_limit: quotaPayload.free_sets_limit!,
        free_sets_period: quotaPayload.free_sets_period!,
        free_mocks_limit: quotaPayload.free_mocks_limit!,
        free_mocks_period: quotaPayload.free_mocks_period!,
        free_learn_limit: quotaPayload.free_learn_limit!,
        free_learn_period: quotaPayload.free_learn_period!,
        free_skill_trainer_limit: quotaPayload.free_skill_trainer_limit!,
        free_skill_trainer_period: quotaPayload.free_skill_trainer_period!,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>UCAT Free tier limits</CardTitle>
        <CardDescription>
          Per-area usage limits for UCAT Free students. Each area has its own limit and reset period;
          quotas do not share a pool. Set limit to <strong>0</strong> to disable an area for Free
          students. Period boundaries use each student&apos;s timezone (weeks start Monday).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {FREE_QUOTA_AREAS.map((area) => {
            const entry = freeQuotas[area.key] ?? { limit: '0', period: 'day' as UcatQuotaPeriod };
            const disabled = parseInt(entry.limit, 10) === 0;

            return (
              <div
                key={area.key}
                className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_140px_140px] md:items-end"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{area.label}</p>
                  <p className="text-xs text-muted-foreground">{area.description}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${area.key}-limit`}>Limit</Label>
                  <Input
                    id={`${area.key}-limit`}
                    type="number"
                    min={0}
                    value={entry.limit}
                    onChange={(e) =>
                      setFreeQuotas((prev) => ({
                        ...prev,
                        [area.key]: { ...entry, limit: e.target.value },
                      }))
                    }
                  />
                  {disabled ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">Disabled on Free</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${area.key}-period`}>Per</Label>
                  <Select
                    value={entry.period}
                    onValueChange={(v) => {
                      if (!isQuotaPeriod(v)) return;
                      setFreeQuotas((prev) => ({
                        ...prev,
                        [area.key]: { ...entry, period: v },
                      }));
                    }}
                  >
                    <SelectTrigger id={`${area.key}-period`}>
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
            );
          })}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save limits'}
        </Button>
      </CardContent>
    </Card>
  );
}
