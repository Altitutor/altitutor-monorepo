"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@/app/api/ucat/progress/route";
import type { ProgressMode } from "../lib/progress-mode";
import {
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  /** When true, cards link to section detail page */
  linkToSection?: boolean;
  mode: ProgressMode;
  timeFrameDays: string;
};

export function SectionProgressCards({
  sections,
  linkToSection = false,
  mode,
  timeFrameDays: _timeFrameDays,
}: SectionProgressCardsProps) {
  const getScaledScore = (section: SectionProgress): number | null =>
    mode === "weighted"
      ? section.weightedAverageScaledScore
      : section.averageScaledScore;

  const getPercentage = (section: SectionProgress): number =>
    mode === "weighted" && section.weightedAveragePercentage != null
      ? Math.round(section.weightedAveragePercentage)
      : section.percentage;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const score = getScaledScore(section);
          const card = (
            <Card
              className={cn(
                UCAT_CARD_CHROME,
                linkToSection && UCAT_CARD_RAISED_HOVER,
              )}
            >
              <CardHeader
                className={cn(
                  "pb-2",
                  linkToSection &&
                    "flex flex-row items-start justify-between gap-2 space-y-0",
                )}
              >
                <CardTitle className="text-base font-medium">
                  {section.sectionName}
                </CardTitle>
                {linkToSection ? (
                  <span
                    className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden
                  >
                    View
                    <ChevronRight className="h-4 w-4" />
                  </span>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Scaled score
                  </div>
                  <div
                    className={cn(
                      "text-3xl font-bold tabular-nums",
                      score == null && "text-muted-foreground",
                    )}
                  >
                    {score != null ? (
                      <AnimatedInteger value={Math.round(score)} />
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Percentage correct
                  </div>
                  <ProgressCircular
                    percentage={getPercentage(section)}
                    size={120}
                    strokeWidth={10}
                    className="text-accent"
                    footerCount={section.maxScore}
                    footerSuffix="questions completed"
                  />
                </div>
              </CardContent>
            </Card>
          );
          return linkToSection ? (
            <Link
              key={section.sectionId}
              href={`/progress/sections/${section.sectionNumber}`}
              className="group block"
              aria-label={`View ${section.sectionName} section progress`}
            >
              {card}
            </Link>
          ) : (
            <Fragment key={section.sectionId}>{card}</Fragment>
          );
        })}
      </div>
    </div>
  );
}
