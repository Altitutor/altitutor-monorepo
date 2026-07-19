"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_RAISED_HOVER,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@altitutor/shared";
import type { ProgressMode } from "../lib/progress-mode";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";
import { AnimatedInteger } from "./progress-animated-display";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  /** When true, cards link to section detail page */
  linkToSection?: boolean;
  /** Base path for section links (default: /progress/sections) */
  sectionHrefPrefix?: string;
  mode: ProgressMode;
  timeFrameDays: string;
  scoreProjections?: SectionScoreProjection[];
  sectionTargets?: Record<string, number>;
  mockRecentWeightedAverage?: number | null;
};

export function SectionProgressCards({
  sections,
  linkToSection = false,
  sectionHrefPrefix = "/progress/sections",
  mode: _mode,
  timeFrameDays: _timeFrameDays,
  scoreProjections,
  sectionTargets = {},
  mockRecentWeightedAverage = null,
}: SectionProgressCardsProps) {
  const showPredictedScores = scoreProjections != null;
  const scoreBySectionNumber = new Map(
    (scoreProjections ?? []).map((projection) => [
      projection.sectionNumber,
      projection,
    ]),
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {sections.map((section) => {
        const projection = scoreBySectionNumber.get(section.sectionNumber);
        const score = projection?.currentEstimate ?? null;
        const target = sectionTargets[section.sectionId] ?? null;
        const gap =
          score != null && target != null ? Math.round(target - score) : null;
        const scorePosition =
          score == null
            ? null
            : Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
        const targetPosition =
          target == null
            ? null
            : Math.max(0, Math.min(100, ((target - 300) / 600) * 100));
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
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Estimated score
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
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <div
                          className="relative h-7"
                          aria-label={`Score scale from 300 to 900${score == null ? "" : `, current estimate ${Math.round(score)}`}${target == null ? "" : `, target ${target}`}`}
                        >
                          <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-muted" />
                          {scorePosition != null && targetPosition != null ? (
                            <div
                              className="absolute top-3 h-1 rounded-full bg-primary/35"
                              style={{
                                left: `${Math.min(scorePosition, targetPosition)}%`,
                                width: `${Math.abs(targetPosition - scorePosition)}%`,
                              }}
                            />
                          ) : null}
                          {targetPosition != null ? (
                            <div
                              className="absolute top-0 -translate-x-1/2"
                              style={{ left: `${targetPosition}%` }}
                            >
                              <span className="block h-7 w-px bg-foreground/55" />
                              <span className="sr-only">Target {target}</span>
                            </div>
                          ) : null}
                          {scorePosition != null ? (
                            <div
                              className="absolute top-1.5 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary shadow-sm ring-1 ring-primary/35"
                              style={{ left: `${scorePosition}%` }}
                            />
                          ) : null}
                        </div>
                        <div className="flex justify-between text-[11px] leading-none tabular-nums text-muted-foreground">
                          <span>300</span>
                          <span>900</span>
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Target</span>
                        <span className="font-semibold tabular-nums">
                          {target ?? "—"}
                        </span>
                      </div>
                      {target != null ? (
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Gap</span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              gap != null &&
                                gap <= 0 &&
                                "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {gap == null
                              ? "—"
                              : gap <= 0
                                ? `${Math.abs(gap)} ahead`
                                : `${gap} points`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Complete timed sets or mocks to establish an estimated
                    score.
                  </p>
                )}
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
      {linkToSection ? (
        <Link
          href="/progress/mocks"
          className="group col-span-2 block"
          aria-label="View mock progress"
        >
          <Card className={cn(UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER)}>
            <CardHeader className="relative space-y-0 pr-12">
              <CardTitle className="text-base font-medium">Mocks</CardTitle>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center sm:right-3">
                <UcatHoverChevron className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">
                Recent-weighted average
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {mockRecentWeightedAverage ?? "—"}
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
