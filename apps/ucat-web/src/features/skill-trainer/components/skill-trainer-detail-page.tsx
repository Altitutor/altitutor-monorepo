"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";

export function SkillTrainerDetailPage({ trainerKey }: { trainerKey: string }) {
  const router = useRouter();
  const { data: trainers } = useSkillTrainers();
  const { data: quota } = useQuotaUsage();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openQuotaLimit } = useQuotaLimitModal();

  const trainer = trainers?.find((t) => t.key === trainerKey);

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
      router.push(`/skill-trainer/${trainerKey}/play?attemptId=${state.attempt.id}`);
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/skill-trainer" className="hover:underline">
          Skill trainer
        </Link>
        <span>/</span>
        <span>{trainer?.name ?? trainerKey}</span>
      </div>

      <UcatPageHeader
        title={trainer?.name ?? "Skill trainer"}
        description={trainer?.description ?? undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to play?</CardTitle>
          <CardDescription>
            {trainer?.time_limit_seconds ?? 60}s timed run · wrong answers trigger a cooldown
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handleStart()} disabled={starting}>
            {starting ? "Starting…" : "Start"}
          </Button>
          {error ? <p className="text-sm text-destructive w-full">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillTrainerLeaderboard trainerKey={trainerKey} />
        </CardContent>
      </Card>

    </div>
  );
}
