"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@altitutor/ui";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { UcatPageHeader } from "@/features/layout";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import type { SkillTrainerCatalogRow } from "@/features/skill-trainer/api/skill-trainer-api";

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
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">Failed to load skill trainers.</p>
      ) : null}

      {sections.map((section) => (
        <section key={section.sectionNumber} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.sectionName}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {section.trainers
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((trainer) => (
                <Link key={trainer.id} href={`/skill-trainer/${trainer.key}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="text-base">{trainer.name}</CardTitle>
                      <CardDescription>
                        {trainer.description ?? "Timed skill drill"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {trainer.time_limit_seconds}s per run
                      {trainer.streak_enabled ? " · streak scoring" : ""}
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
