"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_CARD_CHROME,
  UCAT_CONTROL_PRESS,
  UCAT_PRESSABLE_SURFACE_HOVER,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@altitutor/shared";
import type { ProgressMode } from "../lib/progress-mode";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  linkToSection?: boolean;
  sectionHrefPrefix?: string;
  mode: ProgressMode;
  timeFrameDays: string;
  scoreProjections?: SectionScoreProjection[];
  sectionTargets?: Record<string, number>;
  mockRecentWeightedAverage?: number | null;
  mockTargetScore?: number | null;
};

function ScoreScale({
  score,
  target,
  scoreLabel,
  minimum = 300,
  maximum = 900,
}: {
  score: number | null;
  target: number | null;
  scoreLabel: string;
  minimum?: number;
  maximum?: number;
}) {
  const range = maximum - minimum;
  const scorePosition =
    score == null ? null : Math.max(0, Math.min(100, ((score - minimum) / range) * 100));
  const targetPosition =
    target == null ? null : Math.max(0, Math.min(100, ((target - minimum) / range) * 100));

  if (score == null) {
    const examplePosition = targetPosition == null ? 58 : Math.max(18, targetPosition - 22);

    return (
      <div className="min-w-0 flex-1" aria-label={`${scoreLabel} pending`}>
        <div className="relative h-7 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 blur-[1.5px] opacity-50">
            <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-muted-foreground/35" />
            <div
              className="absolute top-1.5 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary ring-1 ring-primary/40"
              style={{ left: `${examplePosition}%` }}
            />
            {targetPosition != null ? (
              <div
                className="absolute top-0 h-7 w-px bg-foreground/70"
                style={{ left: `${targetPosition}%` }}
              />
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{scoreLabel} pending</span>
          <span>{target == null ? "Target not set" : `Target ${target}`}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-0 flex-1"
      aria-label={`${scoreLabel} ${Math.round(score)}${target == null ? "" : `, target ${target}`}`}
    >
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-muted" />
        {scorePosition != null && targetPosition != null ? (
          <div
            className="absolute top-3.5 h-1 rounded-full bg-primary/35"
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
            <span className="block h-8 w-px bg-foreground/55" />
          </div>
        ) : null}
        <div
          className="absolute top-2 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary shadow-sm ring-1 ring-primary/35"
          style={{ left: `${scorePosition}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {scoreLabel} <strong className="font-semibold text-foreground tabular-nums">{Math.round(score)}</strong>
        </span>
        <span className="text-muted-foreground">
          {target == null ? "Target not set" : <>Target <strong className="font-semibold text-foreground tabular-nums">{target}</strong></>}
        </span>
      </div>
    </div>
  );
}

export function SectionProgressCards({
  sections,
  linkToSection = false,
  sectionHrefPrefix = "/progress/sections",
  mode: _mode,
  timeFrameDays: _timeFrameDays,
  scoreProjections,
  sectionTargets = {},
  mockRecentWeightedAverage = null,
  mockTargetScore = null,
}: SectionProgressCardsProps) {
  const scoreBySectionNumber = new Map(
    (scoreProjections ?? []).map((projection) => [projection.sectionNumber, projection]),
  );

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full overflow-hidden")}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium">Score by section</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {sections.map((section) => {
            const score = scoreBySectionNumber.get(section.sectionNumber)?.currentEstimate ?? null;
            const href = `${sectionHrefPrefix}/${section.sectionNumber}`;
            const content = (
              <>
                <h3 className="min-w-0 text-sm font-semibold">
                  {section.sectionName}
                </h3>
                {linkToSection ? (
                  <UcatHoverChevron className="size-4 text-muted-foreground" />
                ) : null}
                <div className="col-span-2">
                <ScoreScale
                  score={score}
                  target={sectionTargets[section.sectionId] ?? null}
                  scoreLabel="Estimate"
                />
                </div>
              </>
            );
            return linkToSection ? (
              <Link
                key={section.sectionId}
                href={href}
                className={cn(
                  "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  UCAT_CONTROL_PRESS,
                  UCAT_PRESSABLE_SURFACE_HOVER,
                )}
                aria-label={`View ${section.sectionName} progress`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={section.sectionId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3"
              >
                {content}
              </div>
            );
          })}
          {linkToSection ? (
            <Link
              href="/progress/mocks"
              className={cn(
                "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-muted/10 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                UCAT_CONTROL_PRESS,
                UCAT_PRESSABLE_SURFACE_HOVER,
              )}
              aria-label="View mock progress"
            >
              <h3 className="text-sm font-semibold">Mocks</h3>
              <UcatHoverChevron className="size-4 text-muted-foreground" />
              <div className="col-span-2">
                <ScoreScale
                  score={mockRecentWeightedAverage}
                  target={mockTargetScore}
                  scoreLabel="Weighted average"
                  minimum={900}
                  maximum={2700}
                />
              </div>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
