"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle, Skeleton } from "@altitutor/ui";
import { trainerKeyToSlug, type UcatSkillTrainerKey } from "@altitutor/shared";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { UcatPageHeader } from "@/features/layout";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import type { SkillTrainerCatalogRow } from "@/features/skill-trainer/api/skill-trainer-api";
import { TrainerIcon } from "@/features/skill-trainer/lib/trainer-icons";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

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
  const sections = groupBySection(trainers ?? []);

  return (
    <div className="space-y-6">
      <QuotaUsageCard area="skill_trainer" />
      <UcatPageHeader
        title="Skill trainer"
        description="Timed drills to sharpen individual UCAT skills. Pick a trainer, beat your best score, and climb the leaderboard."
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">Failed to load skill trainers.</p>
      ) : null}

      {sections.map((section) => (
        <section key={section.sectionNumber} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.sectionName}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.trainers
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((trainer) => (
                <Link
                  key={trainer.id}
                  href={`/skill-trainer/${trainerKeyToSlug(trainer.key as UcatSkillTrainerKey)}`}
                >
                  <Card
                    className={cn(
                      "h-full transition-shadow hover:shadow-md",
                      UCAT_SURFACE_CARD,
                      UCAT_SURFACE_MOTION,
                    )}
                  >
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <TrainerIcon name={trainer.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-sm font-semibold leading-tight">
                          {trainer.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs">
                          {trainer.description ?? "Timed skill drill"}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
