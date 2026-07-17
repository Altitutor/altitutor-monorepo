"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { SkillTrainerScoreBar } from "@/features/skill-trainer/components/skill-trainer-score-bar";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import type { LearningModuleBlockRow } from "@/features/learning/types";

type LearnSkillTrainerBlockProps = {
  block: LearningModuleBlockRow;
  onComplete?: () => void;
};

type PreparedSession = {
  session: SkillTrainerAttemptState;
  items: Array<{ id: string; content: Record<string, unknown> }>;
  trainerName: string;
};

export function LearnSkillTrainerBlock({ block, onComplete }: LearnSkillTrainerBlockProps) {
  const [prepared, setPrepared] = useState<PreparedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [startedSession, setStartedSession] = useState<PreparedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trainerKey = (block.content as { trainerKey?: string } | null)?.trainerKey;

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    setPrepared(null);
    setStartedSession(null);
    setError(null);
    if (!block.id || !trainerKey || !isUcatSkillTrainerKey(trainerKey)) return;
    setLoading(true);

    void skillTrainerApi
      .prepareLearningModuleSkillTrainerSession({
        trainerKey,
        learningModuleBlockId: block.id,
      })
      .then((session) => {
        if (!cancelled) setPrepared(session);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load skill trainer");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [block.id, trainerKey]);

  function handleStart() {
    if (!prepared) return;
    const startedAt = new Date();
    const timeLimit = prepared.session.attempt.config_snapshot.time_limit_seconds;
    setStartedSession({
      ...prepared,
      session: {
        ...prepared.session,
        attempt: {
          ...prepared.session.attempt,
          started_at: startedAt.toISOString(),
          ends_at: new Date(startedAt.getTime() + timeLimit * 1000).toISOString(),
          score: 0,
          streak_count: 0,
          current_item_index: 0,
          completed_at: null,
        },
        currentItem: prepared.items[0] ?? null,
        nextItem: prepared.items[1] ?? null,
        remainingSeconds: timeLimit,
        isExpired: false,
        isCompleted: false,
      },
    });
  }

  if (!trainerKey || !block.skill_trainer_id) {
    return <p className="text-sm text-muted-foreground">Skill trainer not configured.</p>;
  }

  if (!isUcatSkillTrainerKey(trainerKey)) {
    return <p className="text-sm text-destructive">Unsupported skill trainer.</p>;
  }

  if (startedSession) {
    return (
      <div className="min-h-[520px] rounded-lg border p-4">
        <SkillTrainerPlayPage
          key={startedSession.session.attempt.started_at ?? "started"}
          trainerKey={trainerKey}
          embedded
          initialState={startedSession.session}
          localItems={startedSession.items}
          onComplete={handleComplete}
          onRestart={handleStart}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[520px] flex-col rounded-lg border p-4">
      <SkillTrainerScoreBar
        remaining={prepared?.session.attempt.config_snapshot.time_limit_seconds ?? 0}
        score={0}
        streak={0}
        streakEnabled={Boolean(prepared?.session.attempt.config_snapshot.streak_enabled)}
        scoreDelta={null}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="space-y-1">
          <p className="text-xl font-semibold">
            {prepared?.trainerName ?? "Skill trainer"}
          </p>
        </div>
        <div className="flex justify-center">
          <Button onClick={handleStart} disabled={loading || !prepared}>
            {loading ? "Loading…" : "Start skill trainer"}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
