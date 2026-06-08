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

function TrainerConfigCard({ trainer }: { trainer: TrainerWithConfig }) {
  const [enabled, setEnabled] = useState(trainer.is_enabled);
  const [timeLimit, setTimeLimit] = useState(String(trainer.config?.time_limit_seconds ?? 60));
  const [cooldown, setCooldown] = useState(String(trainer.config?.wrong_cooldown_seconds ?? 2));
  const [pointsCorrect, setPointsCorrect] = useState(String(trainer.config?.points_correct ?? 10));
  const [pointsWrong, setPointsWrong] = useState(String(trainer.config?.points_wrong ?? 5));
  const [streakEnabled, setStreakEnabled] = useState(trainer.config?.streak_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(trainer.is_enabled);
    setTimeLimit(String(trainer.config?.time_limit_seconds ?? 60));
    setCooldown(String(trainer.config?.wrong_cooldown_seconds ?? 2));
    setPointsCorrect(String(trainer.config?.points_correct ?? 10));
    setPointsWrong(String(trainer.config?.points_wrong ?? 5));
    setStreakEnabled(trainer.config?.streak_enabled ?? false);
  }, [trainer]);

  async function handleSave() {
    if (!trainer.config) return;
    setSaving(true);
    setMessage(null);
    const updates: SkillTrainerConfigUpdate = {
      is_enabled: enabled,
      time_limit_seconds: Number(timeLimit),
      wrong_cooldown_seconds: Number(cooldown),
      points_correct: Number(pointsCorrect),
      points_wrong: Number(pointsWrong),
      streak_enabled: streakEnabled,
    };
    try {
      await ucatSkillTrainerConfigApi.updateTrainer(trainer.id, trainer.config.id, updates);
      setMessage('Saved');
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
          <Label>Wrong-answer cooldown (seconds)</Label>
          <Input value={cooldown} onChange={(e) => setCooldown(e.target.value)} type="number" min={0} />
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

export function UcatSkillTrainerConfigForm() {
  const [trainers, setTrainers] = useState<TrainerWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setTrainers(await ucatSkillTrainerConfigApi.list());
      } catch {
        setError('Failed to load skill trainer config');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-6">
      {trainers.map((trainer) => (
        <TrainerConfigCard key={trainer.id} trainer={trainer} />
      ))}
    </div>
  );
}
