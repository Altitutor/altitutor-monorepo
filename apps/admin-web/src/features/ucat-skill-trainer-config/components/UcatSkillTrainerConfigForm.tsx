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
  Switch,
} from '@altitutor/ui';
import {
  ucatSkillTrainerConfigApi,
  type SkillTrainerConfigUpdate,
} from '../api/ucat-skill-trainer-config';

type TrainerWithConfig = Awaited<ReturnType<typeof ucatSkillTrainerConfigApi.list>>[number];

function TrainerConfigCard({
  trainer,
  onSaved,
}: {
  trainer: TrainerWithConfig;
  onSaved?: () => void;
}) {
  const [enabled, setEnabled] = useState(trainer.is_enabled);
  const [timeLimit, setTimeLimit] = useState(String(trainer.config?.time_limit_seconds ?? 60));
  const [pointsCorrect, setPointsCorrect] = useState(String(trainer.config?.points_correct ?? 10));
  const [pointsWrong, setPointsWrong] = useState(String(trainer.config?.points_wrong ?? 5));
  const [streakEnabled, setStreakEnabled] = useState(trainer.config?.streak_enabled ?? false);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(trainer.config?.speed_bonus_enabled ?? false);
  const [speedBonusMaxPoints, setSpeedBonusMaxPoints] = useState(String(trainer.config?.speed_bonus_max_points ?? 5));
  const [speedBonusWindow, setSpeedBonusWindow] = useState(String(trainer.config?.speed_bonus_window_seconds ?? 8));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(trainer.is_enabled);
    setTimeLimit(String(trainer.config?.time_limit_seconds ?? 60));
    setPointsCorrect(String(trainer.config?.points_correct ?? 10));
    setPointsWrong(String(trainer.config?.points_wrong ?? 5));
    setStreakEnabled(trainer.config?.streak_enabled ?? false);
    setSpeedBonusEnabled(trainer.config?.speed_bonus_enabled ?? false);
    setSpeedBonusMaxPoints(String(trainer.config?.speed_bonus_max_points ?? 5));
    setSpeedBonusWindow(String(trainer.config?.speed_bonus_window_seconds ?? 8));
  }, [trainer]);

  async function handleSave() {
    if (!trainer.config) return;
    setSaving(true);
    setMessage(null);
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
      setMessage('Saved');
      onSaved?.();
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{trainer.name}</CardTitle>
        <CardDescription>{trainer.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} id={`enabled-${trainer.id}`} />
          <Label htmlFor={`enabled-${trainer.id}`}>Enabled for students</Label>
        </div>
        <div className="space-y-2">
          <Label>Time limit (seconds)</Label>
          <Input value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} type="number" min={1} />
        </div>
        <div className="space-y-2">
          <Label>Points (correct)</Label>
          <Input value={pointsCorrect} onChange={(e) => setPointsCorrect(e.target.value)} type="number" />
        </div>
        <div className="space-y-2">
          <Label>Points (wrong, subtracted)</Label>
          <Input value={pointsWrong} onChange={(e) => setPointsWrong(e.target.value)} type="number" min={0} />
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch checked={streakEnabled} onCheckedChange={setStreakEnabled} id={`streak-${trainer.id}`} />
          <Label htmlFor={`streak-${trainer.id}`}>Streak scoring enabled</Label>
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch checked={speedBonusEnabled} onCheckedChange={setSpeedBonusEnabled} id={`speed-${trainer.id}`} />
          <Label htmlFor={`speed-${trainer.id}`}>Bonus points for speed</Label>
        </div>
        <div className="space-y-2">
          <Label>Max speed bonus points</Label>
          <Input
            value={speedBonusMaxPoints}
            onChange={(e) => setSpeedBonusMaxPoints(e.target.value)}
            type="number"
            min={0}
          />
        </div>
        <div className="space-y-2">
          <Label>Speed bonus window (seconds)</Label>
          <Input
            value={speedBonusWindow}
            onChange={(e) => setSpeedBonusWindow(e.target.value)}
            type="number"
            min={1}
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function UcatSkillTrainerConfigForm({
  trainer,
  onSaved,
}: {
  trainer?: TrainerWithConfig | null;
  onSaved?: () => void;
}) {
  const [trainers, setTrainers] = useState<TrainerWithConfig[]>([]);
  const [loading, setLoading] = useState(!trainer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trainer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        setTrainers(await ucatSkillTrainerConfigApi.list());
      } catch {
        setError('Failed to load skill trainer config');
      } finally {
        setLoading(false);
      }
    })();
  }, [trainer]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (trainer) {
    return <TrainerConfigCard trainer={trainer} onSaved={onSaved} />;
  }

  return (
    <div className="space-y-6">
      {trainers.map((trainer) => (
        <TrainerConfigCard key={trainer.id} trainer={trainer} onSaved={onSaved} />
      ))}
    </div>
  );
}
