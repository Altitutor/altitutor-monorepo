"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import { ArrowRight } from "lucide-react";
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
    score == null
      ? null
      : Math.max(0, Math.min(100, ((score - minimum) / range) * 100));
  const targetPosition =
    target == null
      ? null
      : Math.max(0, Math.min(100, ((target - minimum) / range) * 100));

  if (score == null) {
    const examplePosition =
      targetPosition == null ? 58 : Math.max(18, targetPosition - 22);

    return (
      <div className="min-w-0" aria-label={`${scoreLabel} pending`}>
        <div className="relative h-5 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 blur-[1.5px] opacity-50">
            <div className="absolute inset-x-0 top-2 h-1 rounded-full bg-muted-foreground/35" />
            <div
              className="absolute top-0.5 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary ring-1 ring-primary/40"
              style={{ left: `${examplePosition}%` }}
            />
            {targetPosition != null ? (
              <div
                className="absolute top-0 h-5 w-px bg-foreground/70"
                style={{ left: `${targetPosition}%` }}
              />
            ) : null}
          </div>
        </div>
        <div className="mt-0.5 flex justify-between gap-2 text-[10px] leading-4 text-muted-foreground">
          <span>{scoreLabel} pending</span>
          <span>{target == null ? "Target not set" : `Target ${target}`}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-0"
      aria-label={`${scoreLabel} ${Math.round(score)}${target == null ? "" : `, target ${target}`}`}
    >
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-muted" />
        {scorePosition != null && targetPosition != null ? (
          <div
            className="absolute top-2.5 h-1 rounded-full bg-primary/35"
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
            <span className="block h-6 w-px bg-foreground/55" />
          </div>
        ) : null}
        <div
          className="absolute top-0.5 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary shadow-sm ring-1 ring-primary/35"
          style={{ left: `${scorePosition}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-[10px] leading-4">
        <span className="text-muted-foreground">
          {scoreLabel}{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {Math.round(score)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          {target == null ? (
            "Target not set"
          ) : (
            <>
              Target{" "}
              <strong className="font-semibold text-foreground tabular-nums">
                {target}
              </strong>
            </>
          )}
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
    (scoreProjections ?? []).map((projection) => [
      projection.sectionNumber,
      projection,
    ]),
  );

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full overflow-hidden")}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium">
          Score by section
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {sections.map((section) => {
            const score =
              scoreBySectionNumber.get(section.sectionNumber)
                ?.currentEstimate ?? null;
            const href = `${sectionHrefPrefix}/${section.sectionNumber}`;
            return (
              <div
                key={section.sectionId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <h3 className="min-w-0 text-sm font-semibold">
                    {section.sectionName}
                  </h3>
                  <div className="mt-1.5">
                    <ScoreScale
                      score={score}
                      target={sectionTargets[section.sectionId] ?? null}
                      scoreLabel="Estimate"
                    />
                  </div>
                </div>
                {linkToSection ? (
                  <Button asChild size="sm" className="h-8 shrink-0 px-3">
                    <Link
                      href={href}
                      aria-label={`View ${section.sectionName} progress`}
                    >
                      View
                      <ArrowRight className="ml-1 size-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
          {linkToSection ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-muted/10 px-4 py-2.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Mocks</h3>
                <div className="mt-1.5">
                  <ScoreScale
                    score={mockRecentWeightedAverage}
                    target={mockTargetScore}
                    scoreLabel="Weighted average"
                    minimum={900}
                    maximum={2700}
                  />
                </div>
              </div>
              <Button asChild size="sm" className="h-8 shrink-0 px-3">
                <Link href="/progress/mocks" aria-label="View mock progress">
                  View
                  <ArrowRight className="ml-1 size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
