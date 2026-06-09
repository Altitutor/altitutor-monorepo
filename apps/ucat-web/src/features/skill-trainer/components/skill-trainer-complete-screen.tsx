"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trainerKeyToSlug, type UcatSkillTrainerKey } from "@altitutor/shared";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import { UCAT_PRIMARY_ACTION_BUTTON, UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function SkillTrainerCompleteScreen({
  trainerKey,
  finalScore,
  onLeave,
}: {
  trainerKey: UcatSkillTrainerKey;
  finalScore: number;
  onLeave: () => void;
}) {
  const router = useRouter();
  const slug = trainerKeyToSlug(trainerKey);
  const { data: quota } = useQuotaUsage();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openQuotaLimit } = useQuotaLimitModal();

  const skillTrainerQuota = quota?.areas.find((a) => a.area === "skill_trainer");

  async function handlePlayAgain() {
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
      onLeave();
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Time&apos;s up!</h1>
        <p className="text-4xl font-bold">{finalScore}</p>
        <p className="text-sm text-muted-foreground">Final score</p>
      </div>

      <section
        className={cn(
          "space-y-4 rounded-ucatShell p-4",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <SkillTrainerLeaderboard trainerKey={trainerKey} />
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href={`/skill-trainer/${slug}`} data-skip-leave-warning>
            Back to trainer
          </Link>
        </Button>
        <Button
          type="button"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          disabled={starting}
          onClick={() => void handlePlayAgain()}
        >
          {starting ? "Starting…" : "Play again"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
