"use client";

import Link from "next/link";
import { Card, CardContent } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { ListChecks, Sparkles } from "lucide-react";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const SECTIONS = [1, 2, 3, 4] as const;

export function SetsLandingPage() {
  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Sets"
        description="Choose a section to browse and practice question sets."
      />
      <QuotaUsageCard area="sets" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((num) => {
          const label = SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`;
          return (
            <Link
              key={num}
              href={`/sets/sections/${num}`}
              className="group block h-full min-w-0"
            >
              <Card
                className={cn(UCAT_CARD_CHROME, "h-full", UCAT_CARD_RAISED_HOVER)}
              >
                <CardContent className="flex flex-col items-start gap-0 p-6">
                  <div className="flex w-full items-start justify-between">
                    <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                      <ListChecks className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                    </div>
                    <UcatHoverChevron />
                  </div>
                  <span className="mt-4 font-semibold">{label}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Create
        </h2>
        <Link href="/sets/set-generator" className="group block min-w-0">
          <Card className={cn(UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER)}>
            <CardContent className="flex flex-col items-start gap-0 p-6">
              <div className="flex w-full items-start justify-between">
                <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                  <Sparkles className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                </div>
                <UcatHoverChevron />
              </div>
              <span className="mt-4 font-semibold">Set Generator</span>
              <p className="mt-1 text-sm text-muted-foreground">
                Build a custom practice set from section, timing, and
                performance filters.
              </p>
            </CardContent>
          </Card>
        </Link>
      </section>
    </div>
  );
}
