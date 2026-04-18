"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { cn } from "@/lib/utils";
import type { SectionProgress } from "@/app/api/ucat/progress/route";
import type { ProgressMode } from "../lib/progress-mode";

type SectionProgressCardsProps = {
  sections: SectionProgress[];
  /** When true, cards link to section detail page */
  linkToSection?: boolean;
  mode: ProgressMode;
  timeFrameDays: string;
};

function CircularProgress({
  percentage,
  total,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  percentage: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-label={`${percentage}% progress`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {total} questions completed
      </span>
    </div>
  );
}

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
                linkToSection && "transition-colors hover:bg-muted/50",
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
                    {score != null ? Math.round(score) : "—"}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Percentage correct
                  </div>
                  <CircularProgress
                    percentage={getPercentage(section)}
                    total={section.maxScore}
                    className="text-accent"
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
