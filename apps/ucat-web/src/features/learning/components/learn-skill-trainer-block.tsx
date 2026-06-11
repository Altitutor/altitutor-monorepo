"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@altitutor/ui";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type { LearningModuleBlockRow } from "@/features/learning/types";

type LearnSkillTrainerBlockProps = {
  block: LearningModuleBlockRow;
  onComplete?: () => void;
};

export function LearnSkillTrainerBlock({ block, onComplete }: LearnSkillTrainerBlockProps) {
  const [starting, setStarting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trainerKey = (block.content as { trainerKey?: string } | null)?.trainerKey;

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    setAttemptId(null);
    setError(null);
  }, [block.id]);

  async function handleStart() {
    if (!block.id || !block.skill_trainer_set_id || !trainerKey) return;
    if (!isUcatSkillTrainerKey(trainerKey)) {
      setError("Unsupported skill trainer.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const state = await skillTrainerApi.startSetAttempt({
        trainerKey,
        skillTrainerSetId: block.skill_trainer_set_id,
        learningModuleBlockId: block.id,
      });
      setAttemptId(state.attempt.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start skill trainer");
    } finally {
      setStarting(false);
    }
  }

  if (!trainerKey || !block.skill_trainer_set_id) {
    return <p className="text-sm text-muted-foreground">Skill trainer not configured.</p>;
  }

  if (!isUcatSkillTrainerKey(trainerKey)) {
    return <p className="text-sm text-destructive">Unsupported skill trainer.</p>;
  }

  if (!attemptId) {
    return (
      <div className="space-y-3">
        <Button onClick={handleStart} disabled={starting}>
          {starting ? "Starting…" : "Start skill trainer"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <SkillTrainerPlayPage
        trainerKey={trainerKey}
        attemptId={attemptId}
        embedded
        onComplete={handleComplete}
      />
    </div>
  );
}
