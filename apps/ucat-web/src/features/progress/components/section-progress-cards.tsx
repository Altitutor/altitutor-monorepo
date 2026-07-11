"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@/app/api/ucat/progress/route";
import type { ProgressMode } from "../lib/progress-mode";
import { formatUcatPercentile } from "../lib/percentiles";
import { getSectionProgressPercentage } from "../lib/progress-data-utils";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";
import {
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  /** When true, cards link to section detail page */
  linkToSection?: boolean;
  /** Base path for section links (default: /progress/sections) */
  sectionHrefPrefix?: string;
  mode: ProgressMode;
  timeFrameDays: string;
  scoreProjections?: SectionScoreProjection[];
};

export function SectionProgressCards({
  sections,
  linkToSection = false,
  sectionHrefPrefix = "/progress/sections",
  mode,
  timeFrameDays: _timeFrameDays,
  scoreProjections,
}: SectionProgressCardsProps) {
  const showPredictedScores = scoreProjections != null;
  const scoreBySectionNumber = new Map(
    (scoreProjections ?? []).map((projection) => [
      projection.sectionNumber,
      projection,
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const projection = scoreBySectionNumber.get(section.sectionNumber);
          const score = projection?.currentEstimate ?? null;
          const percentile = formatUcatPercentile(score, "section");
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
                  linkToSection && "relative space-y-0 pr-12",
                )}
              >
                <CardTitle className="text-base font-medium">
                  {section.sectionName}
                </CardTitle>
                {linkToSection ? (
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center sm:right-3">
                    <UcatHoverChevron className="h-4 w-4" />
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {showPredictedScores ? (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Predicted section score
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
                    {score == null && projection ? (
                      <div className="mt-1 text-xs font-medium text-muted-foreground">
                        Not enough evidence yet
                      </div>
                    ) : percentile ? (
                      <div className="mt-1 text-xs font-medium text-muted-foreground">
                        {percentile}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Percentage correct
                  </div>
                  <ProgressCircular
                    percentage={getSectionProgressPercentage(section, mode)}
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
              href={`${sectionHrefPrefix}/${section.sectionNumber}`}
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
