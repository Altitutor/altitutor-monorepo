"use client";

import { motion } from "motion/react";
import { Skeleton } from "@altitutor/ui";
import { trainerKeyToSlug, type UcatSkillTrainerKey } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import type { SkillTrainerCatalogRow } from "@/features/skill-trainer/api/skill-trainer-api";
import { TrainerIcon } from "@/features/skill-trainer/lib/trainer-icons";
import {
  UcatClickableCardIcon,
  UcatClickableCardLink,
} from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const SECTION_ORDER = [1, 2, 3];

function groupBySection(trainers: SkillTrainerCatalogRow[]) {
  const map = new Map<number, { sectionName: string; trainers: SkillTrainerCatalogRow[] }>();
  for (const trainer of trainers) {
    const existing = map.get(trainer.section_number);
    if (existing) {
      existing.trainers.push(trainer);
    } else {
      map.set(trainer.section_number, {
        sectionName: trainer.section_name,
        trainers: [trainer],
      });
    }
  }
  return SECTION_ORDER.filter((n) => map.has(n)).map((n) => ({
    sectionNumber: n,
    ...map.get(n)!,
  }));
}

export function SkillTrainerHub() {
  const { data: trainers, isLoading, error } = useSkillTrainers();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const sections = groupBySection(trainers ?? []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div id="tour-skill-trainer-page">
          <UcatPageHeader
            title="Skill trainer"
            description="Timed drills to sharpen individual UCAT skills. Pick a trainer, beat your best score, and climb the leaderboard."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-ucatShell" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div id="tour-skill-trainer-page" variants={itemVariants}>
        <UcatPageHeader
          title="Skill trainer"
          description="Timed drills to sharpen individual UCAT skills. Pick a trainer, beat your best score, and climb the leaderboard."
        />
      </motion.div>

      {error ? (
        <motion.p variants={itemVariants} className="text-sm text-destructive">
          Failed to load skill trainers.
        </motion.p>
      ) : null}

      {!error && sections.length === 0 ? (
        <motion.p variants={itemVariants} className="text-sm text-muted-foreground">
          No skill trainers are currently available.
        </motion.p>
      ) : null}

      {sections.map((section) => (
        <motion.section
          key={section.sectionNumber}
          className="space-y-3"
          variants={itemVariants}
        >
          <h2 className="text-lg font-semibold">{section.sectionName}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.trainers
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((trainer) => (
                <UcatClickableCardLink
                  key={trainer.id}
                  href={`/skill-trainer/${trainerKeyToSlug(trainer.key as UcatSkillTrainerKey)}`}
                  iconNode={
                    <UcatClickableCardIcon>
                      <TrainerIcon name={trainer.icon} className="h-5 w-5" />
                    </UcatClickableCardIcon>
                  }
                  title={trainer.name}
                  description={trainer.description ?? "Timed skill drill"}
                />
              ))}
          </div>
        </motion.section>
      ))}
    </motion.div>
  );
}
