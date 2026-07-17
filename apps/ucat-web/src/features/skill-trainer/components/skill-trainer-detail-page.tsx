"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { isUcatSkillTrainerKey, trainerKeyToSlug } from "@altitutor/shared";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { useActiveSkillTrainerAttempt } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { SkillTrainerDemoCard } from "@/features/skill-trainer/components/skill-trainer-demo-card";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import {
  isSkillTrainerAttemptConflictError,
  skillTrainerApi,
} from "@/features/skill-trainer/api/skill-trainer-api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function SkillTrainerDetailPage({
  trainerKey,
}: {
  trainerKey: UcatSkillTrainerKey;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const { data: trainers } = useSkillTrainers();
  const { data: quota } = useQuotaUsage();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictAttempt, setConflictAttempt] =
    useState<SkillTrainerAttemptState | null>(null);
  const [submittingConflict, setSubmittingConflict] = useState(false);
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { active, setLocal } = useActiveSkillTrainerAttempt();
  const refreshedCompletedAttemptRef = useRef<string | null>(null);

  const trainer = trainers?.find((t) => t.key === trainerKey);

  const skillTrainerQuota = quota?.areas.find(
    (a) => a.area === "skill_trainer",
  );
  const quotaDialogOptions = {
    dismissAction: { label: "Dismiss", variant: "dismiss" as const },
  };

  const pendingTrainerLabel = trainer?.name ?? "this skill trainer";
  const conflictTrainerKey =
    conflictAttempt?.attempt.config_snapshot.trainer_key ??
    conflictAttempt?.attempt.trainer_key;
  const conflictTrainer = trainers?.find((t) => t.key === conflictTrainerKey);
  const conflictTrainerLabel =
    conflictTrainer?.name ?? "your current skill trainer";
  const conflictResumeHref =
    conflictTrainerKey != null && isUcatSkillTrainerKey(conflictTrainerKey)
      ? `/skill-trainer/${trainerKeyToSlug(conflictTrainerKey)}/play?attemptId=${conflictAttempt?.attempt.id}`
      : null;

  useEffect(() => {
    if (!active?.isCompleted) return;
    const activeTrainerKey =
      active.attempt.config_snapshot.trainer_key ?? active.attempt.trainer_key;
    if (activeTrainerKey !== trainerKey) return;
    if (refreshedCompletedAttemptRef.current === active.attempt.id) return;

    refreshedCompletedAttemptRef.current = active.attempt.id;
    void queryClient.invalidateQueries({
      queryKey: ["skill-trainers", "leaderboard", trainerKey],
    });
  }, [active, queryClient, trainerKey]);

  async function startAttempt() {
    const state = await skillTrainerApi.startAttempt(trainerKey);
    setLocal(state);
    const activeSlug = trainerKeyToSlug(
      state.attempt.config_snapshot.trainer_key,
    );
    router.push(
      `/skill-trainer/${activeSlug}/play?attemptId=${state.attempt.id}`,
    );
  }

  async function handleStart() {
    if (
      skillTrainerQuota &&
      (skillTrainerQuota.atLimit || skillTrainerQuota.disabled)
    ) {
      openQuotaLimit(
        {
          code: "QUOTA_EXCEEDED",
          area: "skill_trainer",
          used: skillTrainerQuota.used,
          limit: skillTrainerQuota.limit,
          period: skillTrainerQuota.period,
        },
        quotaDialogOptions,
      );
      return;
    }

    setStarting(true);
    setError(null);
    try {
      await startAttempt();
    } catch (err) {
      if (isSkillTrainerAttemptConflictError(err)) {
        setConflictAttempt(err.attempt);
        setLocal(err.attempt);
        return;
      }
      const message = err instanceof Error ? err.message : "Could not start";
      if (message.includes("QUOTA") || message.includes("quota")) {
        if (skillTrainerQuota) {
          openQuotaLimit(
            {
              code: "QUOTA_EXCEEDED",
              area: "skill_trainer",
              used: skillTrainerQuota.used,
              limit: skillTrainerQuota.limit,
              period: skillTrainerQuota.period,
            },
            quotaDialogOptions,
          );
        }
      } else {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitConflictAndStart() {
    if (!conflictAttempt) return;
    setSubmittingConflict(true);
    setError(null);
    try {
      const completed = await skillTrainerApi.completeAttempt(
        conflictAttempt.attempt.id,
      );
      setLocal(completed);
      setConflictAttempt(null);
      await queryClient.invalidateQueries({
        queryKey: ["skill-trainers", "leaderboard"],
      });
      setStarting(true);
      await startAttempt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setSubmittingConflict(false);
      setStarting(false);
    }
  }

  if (!trainer && trainers) {
    return <p className="text-sm text-muted-foreground">Trainer not found.</p>;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={trainer?.name ?? "Skill trainer"}
          description={
            trainer?.description ??
            "Review how this trainer works before starting."
          }
          backHref="/skill-trainer"
          backLabel="Back to skill trainer"
          breadcrumbOverrides={{ 1: trainer?.name ?? trainerKey }}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <SkillTrainerDemoCard trainerKey={trainerKey} />
      </motion.div>

      <motion.section
        aria-labelledby="leaderboard-heading"
        className="space-y-4"
        variants={itemVariants}
      >
        <h2
          id="leaderboard-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Leaderboard
        </h2>
        <SkillTrainerLeaderboard trainerKey={trainerKey} />
      </motion.section>

      <motion.div className="flex justify-end" variants={itemVariants}>
        <Button
          type="button"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          disabled={starting}
          onClick={() => void handleStart()}
        >
          {starting ? "Starting…" : "Start"}
        </Button>
      </motion.div>

      {error ? (
        <motion.p variants={itemVariants} className="text-sm text-destructive">
          {error}
        </motion.p>
      ) : null}

      <AlertDialog
        open={conflictAttempt != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConflictAttempt(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Skill trainer already in progress
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>
                You have an unfinished attempt:{" "}
                <strong>{conflictTrainerLabel}</strong>. Resume it, or submit
                your current score and start{" "}
                <strong>{pendingTrainerLabel}</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setConflictAttempt(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!conflictResumeHref}
              onClick={() => {
                if (conflictResumeHref) router.push(conflictResumeHref);
              }}
            >
              Resume current attempt
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={() => void handleSubmitConflictAndStart()}
              disabled={submittingConflict || starting}
            >
              {submittingConflict || starting
                ? "Submitting..."
                : "Submit current & start new"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
