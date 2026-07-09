'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui';
import { AdminDialogShell } from '@/shared/components';
import type {
  ScoreProjectionSettingsUpdate,
  ScoreProjectionSettingsWithSection,
} from '@/features/score-projection-settings/api/score-projection-settings';
import { useUpdateScoreProjectionSettings } from '@/features/score-projection-settings/hooks/use-score-projection-settings';

type ScoreProjectionSettingsDialogProps = {
  initial: ScoreProjectionSettingsWithSection | null;
  open: boolean;
  onClose: () => void;
};

type FieldKey = keyof ScoreProjectionSettingsUpdate;

type FieldConfig = {
  key: FieldKey;
  label: string;
  description: string;
  step: string;
  min: number;
};

const FIELD_GROUPS: Array<{ title: string; fields: FieldConfig[] }> = [
  {
    title: 'Current estimate',
    fields: [
      {
        key: 'min_prediction_evidence_weight',
        label: 'Minimum prediction evidence weight',
        description: 'Minimum effective evidence required before a predicted section score is shown.',
        step: '0.1',
        min: 0.1,
      },
      {
        key: 'recency_half_life_days',
        label: 'Recency half-life days',
        description: 'Number of days for an attempt to lose half of its recency weight.',
        step: '1',
        min: 1,
      },
      {
        key: 'min_practice_scored_points',
        label: 'Minimum practice scored points',
        description: 'Practice sessions below this total point count are ignored as too small.',
        step: '1',
        min: 1,
      },
    ],
  },
  {
    title: 'Evidence weights',
    fields: [
      {
        key: 'mock_source_weight',
        label: 'Mock source weight',
        description: 'Multiplier applied to mock attempt evidence before recency and volume weighting.',
        step: '0.05',
        min: 0.01,
      },
      {
        key: 'set_source_weight',
        label: 'Set source weight',
        description: 'Multiplier applied to standalone set attempt evidence.',
        step: '0.05',
        min: 0.01,
      },
      {
        key: 'practice_source_weight',
        label: 'Practice source weight',
        description: 'Multiplier applied to practice-session evidence.',
        step: '0.05',
        min: 0.01,
      },
      {
        key: 'timed_weight',
        label: 'Timed weight',
        description: 'Timing multiplier for timed attempts at or faster than exam pace.',
        step: '0.05',
        min: 0.01,
      },
      {
        key: 'slow_timed_weight',
        label: 'Slow timed weight',
        description: 'Timing multiplier for timed attempts slower than exam pace.',
        step: '0.05',
        min: 0.01,
      },
      {
        key: 'untimed_weight',
        label: 'Untimed weight',
        description: 'Timing multiplier for untimed attempts.',
        step: '0.05',
        min: 0.01,
      },
    ],
  },
  {
    title: 'Practice pace',
    fields: [
      {
        key: 'default_effective_questions_per_week',
        label: 'Default effective questions/week',
        description: 'Fallback weekly pace used when recent activity is too sparse.',
        step: '1',
        min: 1,
      },
      {
        key: 'recent_activity_lookback_days',
        label: 'Recent activity lookback days',
        description: 'Window used to calculate recent effective practice pace.',
        step: '1',
        min: 1,
      },
      {
        key: 'effective_practice_daily_cap',
        label: 'Effective practice daily cap',
        description: 'Soft daily cap used to model diminishing returns from high practice volume.',
        step: '1',
        min: 1,
      },
    ],
  },
  {
    title: 'Trajectory',
    fields: [
      {
        key: 'trajectory_horizon_days',
        label: 'Trajectory horizon days',
        description: 'How far ahead the projection curve is generated.',
        step: '1',
        min: 1,
      },
      {
        key: 'trajectory_step_days',
        label: 'Trajectory step days',
        description: 'Spacing between generated points on the projection curve.',
        step: '1',
        min: 1,
      },
      {
        key: 'pessimistic_learning_rate',
        label: 'Pessimistic learning rate',
        description: 'Improvement rate for the lower projection curve.',
        step: '0.0001',
        min: 0.0001,
      },
      {
        key: 'realistic_learning_rate',
        label: 'Realistic learning rate',
        description: 'Improvement rate for the central projection curve.',
        step: '0.0001',
        min: 0.0001,
      },
      {
        key: 'optimistic_learning_rate',
        label: 'Optimistic learning rate',
        description: 'Improvement rate for the upper projection curve.',
        step: '0.0001',
        min: 0.0001,
      },
      {
        key: 'pessimistic_ceiling_uplift',
        label: 'Pessimistic ceiling uplift',
        description: 'Maximum score gain allowed by the lower projection curve.',
        step: '1',
        min: 1,
      },
      {
        key: 'realistic_ceiling_uplift',
        label: 'Realistic ceiling uplift',
        description: 'Maximum score gain allowed by the central projection curve.',
        step: '1',
        min: 1,
      },
      {
        key: 'optimistic_ceiling_uplift',
        label: 'Optimistic ceiling uplift',
        description: 'Maximum score gain allowed by the upper projection curve.',
        step: '1',
        min: 1,
      },
    ],
  },
];

function initialValues(row: ScoreProjectionSettingsWithSection): Record<FieldKey, string> {
  const entries = FIELD_GROUPS.flatMap((group) => group.fields).map((field) => [
    field.key,
    String(row[field.key] ?? ''),
  ]);
  return Object.fromEntries(entries) as Record<FieldKey, string>;
}

export function ScoreProjectionSettingsDialog({
  initial,
  open,
  onClose,
}: ScoreProjectionSettingsDialogProps) {
  const updateMutation = useUpdateScoreProjectionSettings();
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    initial ? initialValues(initial) : emptyValues(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial ? initialValues(initial) : emptyValues());
    setError(null);
  }, [initial]);

  const fields = useMemo(() => FIELD_GROUPS.flatMap((group) => group.fields), []);

  const handleSave = async () => {
    if (!initial) return;
    setError(null);
    const updates: ScoreProjectionSettingsUpdate = {};
    for (const field of fields) {
      const parsed = Number(values[field.key]);
      if (!Number.isFinite(parsed) || parsed < field.min) {
        setError(`${field.label} must be at least ${field.min}.`);
        return;
      }
      (updates as Record<string, number>)[field.key] = parsed;
    }
    try {
      await updateMutation.mutateAsync({ id: initial.id, updates });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <AdminDialogShell
      open={open}
      onClose={onClose}
      title={initial?.sectionName ?? 'Edit score projection settings'}
      subtitle={
        initial
          ? `Section ${initial.sectionNumber} projection assumptions`
          : undefined
      }
      contentClassName="md:max-w-4xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!initial || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </>
      }
    >
      {initial ? (
        <TooltipProvider delayDuration={150}>
          <div className="space-y-6">
            {FIELD_GROUPS.map((group) => (
              <section key={group.title} className="space-y-3">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`${initial.id}-${field.key}`}>
                          {field.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`${field.label} info`}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{field.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id={`${initial.id}-${field.key}`}
                        type="number"
                        step={field.step}
                        min={field.min}
                        value={values[field.key]}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </TooltipProvider>
      ) : null}
    </AdminDialogShell>
  );
}

function emptyValues(): Record<FieldKey, string> {
  return Object.fromEntries(
    FIELD_GROUPS.flatMap((group) => group.fields).map((field) => [
      field.key,
      '',
    ]),
  ) as Record<FieldKey, string>;
}
