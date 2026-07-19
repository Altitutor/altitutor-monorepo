"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
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
    return (
      <div className="min-w-0 flex-1" aria-label={`${scoreLabel} pending`}>
        <div className="relative h-8 overflow-hidden rounded-lg border border-dashed border-border bg-muted/35">
          <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
              Score pending
            </span>
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{scoreLabel}</span>
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
    <Card className={cn(UCAT_CARD_CHROME, "overflow-hidden")}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Score by section</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current estimates compared with your targets.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {sections.map((section) => {
            const score = scoreBySectionNumber.get(section.sectionNumber)?.currentEstimate ?? null;
            const href = `${sectionHrefPrefix}/${section.sectionNumber}`;
            return (
              <div
                key={section.sectionId}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.6fr)_auto] sm:items-center"
              >
                <h3 className="text-sm font-semibold">{section.sectionName}</h3>
                <ScoreScale
                  score={score}
                  target={sectionTargets[section.sectionId] ?? null}
                  scoreLabel="Estimate"
                />
                {linkToSection ? (
                  <Button asChild size="sm" className="w-full sm:w-auto">
                    <Link href={href}>View progress</Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
          {linkToSection ? (
            <div className="grid gap-3 bg-muted/10 px-5 py-4 sm:grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.6fr)_auto] sm:items-center">
              <h3 className="text-sm font-semibold">Mocks</h3>
              <ScoreScale
                score={mockRecentWeightedAverage}
                target={mockTargetScore}
                scoreLabel="Recent weighted average"
                minimum={900}
                maximum={2700}
              />
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href="/progress/mocks">View mocks</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
