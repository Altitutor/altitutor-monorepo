"use client";

import React, { useId, useState } from "react";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  formatExactUcatPercentile,
  formatUcatPercentileOrdinal,
  getUcatPercentile,
  getUcatScoreRange,
  type UcatPercentileScope,
} from "../lib/percentiles";

type PercentileCardProps = {
  scaledScore: number | null | undefined;
  scope: UcatPercentileScope;
  className?: string;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 100;
const CHART_BASELINE = 92;

const CURVE_POINTS = Array.from({ length: 81 }, (_, index) => {
  const x = index / 80;
  const z = (x - 0.5) * 7;
  const density = Math.exp(-0.5 * z * z);
  return `${x * CHART_WIDTH},${CHART_BASELINE - density * 80}`;
}).join(" ");

export function PercentileCard({
  scaledScore,
  scope,
  className,
}: PercentileCardProps) {
  const rawId = useId();
  const clipId = `percentile-${rawId.replace(/:/g, "")}`;
  const percentile = getUcatPercentile(scaledScore, scope);
  const formattedPercentile = formatUcatPercentileOrdinal(scaledScore, scope);
  const range = getUcatScoreRange(scope);
  const score = scaledScore == null ? null : Math.round(scaledScore);
  const [exploredScore, setExploredScore] = useState<number | null>(null);
  const displayScore = exploredScore ?? score;
  const displayPercentile = getUcatPercentile(displayScore, scope);
  const position =
    displayScore == null
      ? CHART_WIDTH / 2
      : ((Math.min(range.max, Math.max(range.min, displayScore)) - range.min) /
          (range.max - range.min)) *
        CHART_WIDTH;

  const comparison =
    percentile == null
      ? "Complete an attempt to see how your score compares."
      : percentile < 20
        ? "Your score is currently within the lower 20% of comparison scores."
        : `Your score is higher than about ${percentile}% of comparison scores.`;

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    const chartPosition = relativeX;
    const rawScore = range.min + chartPosition * (range.max - range.min);
    const step = scope === "mock" ? 10 : 5;
    setExploredScore(Math.round(rawScore / step) * step);
  };

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-base font-medium text-muted-foreground">
            <span>Percentile</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground/80">
                    <Info
                      className="h-3.5 w-3.5"
                      aria-label="Percentile explanation"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  {comparison}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div
            className={cn(
              "mt-1 text-4xl font-bold tabular-nums",
              percentile == null && "text-muted-foreground",
            )}
          >
            {formattedPercentile ?? "—"}
          </div>
        </div>

        {score != null ? (
          <div>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">
                {exploredScore == null ? "Your score" : "Exploring"}
              </span>
              <span className="font-semibold tabular-nums">
                Score {displayScore} ·{" "}
                {displayPercentile == null
                  ? "—"
                  : formatExactUcatPercentile(displayPercentile)}
              </span>
            </div>

            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              tabIndex={0}
              aria-label={`Bell curve showing score ${displayScore} at approximately the ${displayPercentile}th percentile`}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setExploredScore(null)}
              onBlur={() => setExploredScore(null)}
              className="mt-2 aspect-[16/5] h-auto w-full cursor-crosshair overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={position} height={CHART_HEIGHT} />
                </clipPath>
              </defs>
              <polygon
                points={`0,${CHART_BASELINE} ${CURVE_POINTS} ${CHART_WIDTH},${CHART_BASELINE}`}
                className="fill-muted"
              />
              <polygon
                points={`0,${CHART_BASELINE} ${CURVE_POINTS} ${CHART_WIDTH},${CHART_BASELINE}`}
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
                y1="8"
                y2={CHART_BASELINE}
                vectorEffect="non-scaling-stroke"
                className="stroke-foreground"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={position}
                cy={CHART_BASELINE}
                r="4"
                className="fill-foreground"
              />
            </svg>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
