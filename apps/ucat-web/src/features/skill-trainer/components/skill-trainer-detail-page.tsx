"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { trainerKeyToSlug } from "@altitutor/shared";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { SkillTrainerDemoCard } from "@/features/skill-trainer/components/skill-trainer-demo-card";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function SkillTrainerDetailPage({
  trainerKey,
}: {
  trainerKey: UcatSkillTrainerKey;
}) {
  const router = useRouter();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const { data: trainers } = useSkillTrainers();
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const [starting, setStarting] = useState(false);
  const { openQuotaLimit } = useQuotaLimitDialog();

  const trainer = trainers?.find((t) => t.key === trainerKey);

  const skillTrainerQuota = quota?.areas.find(
    (a) => a.area === "skill_trainer",
  );
  const quotaDialogOptions = {
    dismissAction: { label: "Dismiss", variant: "dismiss" as const },
  };

  function handleStart() {
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
    router.push(`/skill-trainer/${trainerKeyToSlug(trainerKey)}/play`);
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
          disabled={starting || quotaLoading}
          onClick={handleStart}
        >
          {starting ? "Starting…" : quotaLoading ? "Loading…" : "Start"}
        </Button>
      </motion.div>
    </motion.div>
  );
}
