'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Switch,
} from '@altitutor/ui';
import { AdminDialogShell } from '@/shared/components';
import {
  ucatSkillTrainerConfigApi,
  type SkillTrainerConfigUpdate,
} from '../api/ucat-skill-trainer-config';

type TrainerWithConfig = Awaited<ReturnType<typeof ucatSkillTrainerConfigApi.list>>[number];

function TrainerConfigFields({
  trainer,
  enabled,
  onEnabledChange,
  timeLimit,
  onTimeLimitChange,
  pointsCorrect,
  onPointsCorrectChange,
  pointsWrong,
  onPointsWrongChange,
  streakEnabled,
  onStreakEnabledChange,
  speedBonusEnabled,
  onSpeedBonusEnabledChange,
  speedBonusMaxPoints,
  onSpeedBonusMaxPointsChange,
  speedBonusWindow,
  onSpeedBonusWindowChange,
}: {
  trainer: TrainerWithConfig;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  timeLimit: string;
  onTimeLimitChange: (value: string) => void;
  pointsCorrect: string;
  onPointsCorrectChange: (value: string) => void;
  pointsWrong: string;
  onPointsWrongChange: (value: string) => void;
  streakEnabled: boolean;
  onStreakEnabledChange: (value: boolean) => void;
  speedBonusEnabled: boolean;
  onSpeedBonusEnabledChange: (value: boolean) => void;
  speedBonusMaxPoints: string;
  onSpeedBonusMaxPointsChange: (value: string) => void;
  speedBonusWindow: string;
  onSpeedBonusWindowChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex items-center gap-2 md:col-span-2">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} id={`enabled-${trainer.id}`} />
        <div className="space-y-0.5">
          <Label htmlFor={`enabled-${trainer.id}`}>Enabled for students</Label>
          <p className="text-xs text-muted-foreground">
            Disabled trainers are hidden throughout ucat-web, but remain available to tutors for question management.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`time-limit-${trainer.id}`}>Time limit (seconds)</Label>
        <Input
          id={`time-limit-${trainer.id}`}
          value={timeLimit}
          onChange={(e) => onTimeLimitChange(e.target.value)}
          type="number"
          min={1}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`points-correct-${trainer.id}`}>Points (correct)</Label>
        <Input
          id={`points-correct-${trainer.id}`}
          value={pointsCorrect}
          onChange={(e) => onPointsCorrectChange(e.target.value)}
          type="number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`points-wrong-${trainer.id}`}>Points (wrong, subtracted)</Label>
        <Input
          id={`points-wrong-${trainer.id}`}
          value={pointsWrong}
          onChange={(e) => onPointsWrongChange(e.target.value)}
          type="number"
          min={0}
        />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Switch checked={streakEnabled} onCheckedChange={onStreakEnabledChange} id={`streak-${trainer.id}`} />
        <Label htmlFor={`streak-${trainer.id}`}>Streak scoring enabled</Label>
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Switch checked={speedBonusEnabled} onCheckedChange={onSpeedBonusEnabledChange} id={`speed-${trainer.id}`} />
        <Label htmlFor={`speed-${trainer.id}`}>Bonus points for speed</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`speed-bonus-max-${trainer.id}`}>Max speed bonus points</Label>
        <Input
          id={`speed-bonus-max-${trainer.id}`}
          value={speedBonusMaxPoints}
          onChange={(e) => onSpeedBonusMaxPointsChange(e.target.value)}
          type="number"
          min={0}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`speed-bonus-window-${trainer.id}`}>Speed bonus window (seconds)</Label>
        <Input
          id={`speed-bonus-window-${trainer.id}`}
          value={speedBonusWindow}
          onChange={(e) => onSpeedBonusWindowChange(e.target.value)}
          type="number"
          min={1}
        />
      </div>
    </div>
  );
}

export function UcatSkillTrainerEditDialog({
  trainer,
  open,
  onClose,
  onSaved,
}: {
  trainer: TrainerWithConfig | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [timeLimit, setTimeLimit] = useState('60');
  const [pointsCorrect, setPointsCorrect] = useState('10');
  const [pointsWrong, setPointsWrong] = useState('5');
  const [streakEnabled, setStreakEnabled] = useState(false);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(false);
  const [speedBonusMaxPoints, setSpeedBonusMaxPoints] = useState('5');
  const [speedBonusWindow, setSpeedBonusWindow] = useState('8');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trainer) return;
    setEnabled(trainer.is_enabled);
    setTimeLimit(String(trainer.config?.time_limit_seconds ?? 60));
    setPointsCorrect(String(trainer.config?.points_correct ?? 10));
    setPointsWrong(String(trainer.config?.points_wrong ?? 5));
    setStreakEnabled(trainer.config?.streak_enabled ?? false);
    setSpeedBonusEnabled(trainer.config?.speed_bonus_enabled ?? false);
    setSpeedBonusMaxPoints(String(trainer.config?.speed_bonus_max_points ?? 5));
    setSpeedBonusWindow(String(trainer.config?.speed_bonus_window_seconds ?? 8));
    setError(null);
  }, [open, trainer]);

  async function handleSave() {
    if (!trainer?.config) return;
    setSaving(true);
    setError(null);
    const updates: SkillTrainerConfigUpdate = {
      is_enabled: enabled,
      time_limit_seconds: Number(timeLimit),
      points_correct: Number(pointsCorrect),
      points_wrong: Number(pointsWrong),
      streak_enabled: streakEnabled,
      speed_bonus_enabled: speedBonusEnabled,
      speed_bonus_max_points: Number(speedBonusMaxPoints),
      speed_bonus_window_seconds: Number(speedBonusWindow),
    };
    try {
      await ucatSkillTrainerConfigApi.updateTrainer(trainer.id, trainer.config.id, updates);
      await Promise.resolve(onSaved?.());
      onClose();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialogShell
        fillHeight
      open={open}
      onClose={onClose}
      title={trainer?.name ?? 'Edit skill trainer config'}
      subtitle={trainer?.description ?? undefined}
      contentClassName="md:max-w-5xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !trainer?.config}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {trainer ? (
        <>
          <TrainerConfigFields
            trainer={trainer}
            enabled={enabled}
            onEnabledChange={setEnabled}
            timeLimit={timeLimit}
            onTimeLimitChange={setTimeLimit}
            pointsCorrect={pointsCorrect}
            onPointsCorrectChange={setPointsCorrect}
            pointsWrong={pointsWrong}
            onPointsWrongChange={setPointsWrong}
            streakEnabled={streakEnabled}
            onStreakEnabledChange={setStreakEnabled}
            speedBonusEnabled={speedBonusEnabled}
            onSpeedBonusEnabledChange={setSpeedBonusEnabled}
            speedBonusMaxPoints={speedBonusMaxPoints}
            onSpeedBonusMaxPointsChange={setSpeedBonusMaxPoints}
            speedBonusWindow={speedBonusWindow}
            onSpeedBonusWindowChange={setSpeedBonusWindow}
          />
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </>
      ) : null}
    </AdminDialogShell>
  );
}
