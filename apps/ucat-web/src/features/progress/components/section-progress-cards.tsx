"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
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
              key={section.sectionId}
              className={cn(
                "rounded-xl border-border",
                linkToSection && UCAT_CARD_RAISED_HOVER,
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  {section.sectionName}
                </CardTitle>
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
            >
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </div>
    </div>
  );
}
