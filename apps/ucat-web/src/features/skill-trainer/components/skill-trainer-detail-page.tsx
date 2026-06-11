"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trainerKeyToSlug } from "@altitutor/shared";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import { SKILL_TRAINER_INSTRUCTIONS } from "@/features/skill-trainer/lib/instructions";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function SkillTrainerDetailPage({ trainerKey }: { trainerKey: UcatSkillTrainerKey }) {
  const router = useRouter();
  const { data: trainers } = useSkillTrainers();
  const { data: quota } = useQuotaUsage();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openQuotaLimit } = useQuotaLimitModal();

  const trainer = trainers?.find((t) => t.key === trainerKey);
  const slug = trainerKeyToSlug(trainerKey);
  const instructions = SKILL_TRAINER_INSTRUCTIONS[trainerKey];

  const skillTrainerQuota = quota?.areas.find((a) => a.area === "skill_trainer");

  async function handleStart() {
    if (
      skillTrainerQuota &&
      (skillTrainerQuota.atLimit || skillTrainerQuota.disabled)
    ) {
      openQuotaLimit({
        code: "QUOTA_EXCEEDED",
        area: "skill_trainer",
        used: skillTrainerQuota.used,
        limit: skillTrainerQuota.limit,
        period: skillTrainerQuota.period,
      });
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const state = await skillTrainerApi.startAttempt(trainerKey);
      router.push(`/skill-trainer/${slug}/play?attemptId=${state.attempt.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start";
      if (message.includes("QUOTA") || message.includes("quota")) {
        if (skillTrainerQuota) {
          openQuotaLimit({
            code: "QUOTA_EXCEEDED",
            area: "skill_trainer",
            used: skillTrainerQuota.used,
            limit: skillTrainerQuota.limit,
            period: skillTrainerQuota.period,
          });
        }
      } else {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  }

  if (!trainer && trainers) {
    return <p className="text-sm text-muted-foreground">Trainer not found.</p>;
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={trainer?.name ?? "Skill trainer"}
        description={trainer?.description ?? "Review how this trainer works before starting."}
        backHref="/skill-trainer"
        backLabel="Back to skill trainer"
        breadcrumbOverrides={{ 1: trainer?.name ?? trainerKey }}
      />

      <section
        className={cn(
          "space-y-3 rounded-ucatShell p-4 text-card-foreground",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <h2 className="text-lg font-semibold">How to play</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="leaderboard-heading" className="space-y-4">
        <h2 id="leaderboard-heading" className="text-2xl font-semibold tracking-tight">
          Leaderboard
        </h2>
        <SkillTrainerLeaderboard trainerKey={trainerKey} />
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          disabled={starting}
          onClick={() => void handleStart()}
        >
          {starting ? "Starting…" : "Start"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
