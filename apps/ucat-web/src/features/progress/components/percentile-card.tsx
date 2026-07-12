"use client";

import React, { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  formatUcatPercentile,
  getUcatPercentile,
  getUcatScoreRange,
  type UcatPercentileScope,
} from "../lib/percentiles";

type PercentileCardProps = {
  scaledScore: number | null | undefined;
  scope: UcatPercentileScope;
  className?: string;
};

const CURVE_POINTS = Array.from({ length: 49 }, (_, index) => {
  const x = index / 48;
  const z = (x - 0.5) * 6;
  const density = Math.exp(-0.5 * z * z);
  return `${4 + x * 92},${50 - density * 40}`;
}).join(" ");

export function PercentileCard({
  scaledScore,
  scope,
  className,
}: PercentileCardProps) {
  const rawId = useId();
  const clipId = `percentile-${rawId.replace(/:/g, "")}`;
  const percentile = getUcatPercentile(scaledScore, scope);
  const formattedPercentile = formatUcatPercentile(scaledScore, scope);
  const range = getUcatScoreRange(scope);
  const score = scaledScore == null ? null : Math.round(scaledScore);
  const [exploredScore, setExploredScore] = useState<number | null>(null);
  const displayScore = exploredScore ?? score;
  const displayPercentile = getUcatPercentile(displayScore, scope);
  const position =
    displayScore == null
      ? 50
      : 4 +
        ((Math.min(range.max, Math.max(range.min, displayScore)) - range.min) /
          (range.max - range.min)) *
          92;

  const comparison =
    percentile == null
      ? "Complete an attempt to see how your score compares."
      : percentile < 20
        ? "Your score is currently within the lower 20% of comparison scores."
        : `Your score is higher than about ${percentile}% of comparison scores.`;

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Percentile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              percentile == null && "text-muted-foreground",
            )}
          >
            {formattedPercentile ?? "—"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{comparison}</p>
        </div>

        {score != null ? (
          <div className="rounded-lg border bg-muted/20 px-3 pb-3 pt-2">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">
                {exploredScore == null ? "Your position" : "Exploring"}
              </span>
              <span className="font-semibold tabular-nums">
                Score {displayScore} ·{" "}
                {displayPercentile == null ? "—" : `${displayPercentile}%`}
              </span>
            </div>

            <svg
              viewBox="0 0 100 58"
              role="img"
              aria-label={`Bell curve showing score ${displayScore} at approximately the ${displayPercentile}th percentile`}
              className="mt-2 h-24 w-full overflow-visible"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={position} height="58" />
                </clipPath>
              </defs>
              <polygon
                points={`4,52 ${CURVE_POINTS} 96,52`}
                className="fill-muted"
              />
              <polygon
                points={`4,52 ${CURVE_POINTS} 96,52`}
                className="fill-primary/25"
                clipPath={`url(#${clipId})`}
              />
              <polyline
                points={CURVE_POINTS}
                fill="none"
                vectorEffect="non-scaling-stroke"
                className="stroke-primary"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1={position}
                x2={position}
                y1="6"
                y2="52"
                vectorEffect="non-scaling-stroke"
                className="stroke-foreground"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={position}
                cy="52"
                r="2.5"
                className="fill-foreground"
              />
            </svg>

            <label className="sr-only" htmlFor={`${clipId}-score`}>
              Explore scores on the percentile distribution
            </label>
            <input
              id={`${clipId}-score`}
              type="range"
              min={range.min}
              max={range.max}
              step={scope === "mock" ? 10 : 5}
              value={displayScore ?? range.min}
              onChange={(event) => setExploredScore(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-primary"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Lower scores</span>
              <span>Higher scores</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Drag to explore the distribution
              </span>
              {exploredScore != null ? (
                <button
                  type="button"
                  onClick={() => setExploredScore(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  My score
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
