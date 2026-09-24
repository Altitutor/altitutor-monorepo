"use client";

import React, { useId, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  calculatePercentileFromBins,
  formatPercentile,
  type CohortPercentileResult,
} from "@altitutor/ucat-percentiles";
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

type PercentileCardProps = {
  scaledScore: number | null | undefined;
  percentile: CohortPercentileResult;
  scope: "set" | "mock";
  className?: string;
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 150;
const CHART_BASELINE = 124;
const CHART_TOP = 12;
const BELL_SIGMA = 0.17;

function scoreRange(scope: PercentileCardProps["scope"]) {
  return scope === "mock" ? { min: 900, max: 2700, step: 10 } : { min: 300, max: 900, step: 5 };
}

function bellCurveY(position: number): number {
  const normalised = (position - 0.5) / BELL_SIGMA;
  const height = Math.exp(-0.5 * normalised * normalised);
  return CHART_BASELINE - height * (CHART_BASELINE - CHART_TOP);
}

export function PercentileCard({
  scaledScore,
  percentile,
  scope,
  className,
}: PercentileCardProps) {
  const range = scoreRange(scope);
  const clipId = useId();
  const score = scaledScore == null ? null : Math.round(scaledScore);
  const [exploredScore, setExploredScore] = useState<number | null>(null);
  const displayScore = exploredScore ?? score;
  const displayPercentile =
    exploredScore == null && percentile.status === "available"
      ? percentile.percentile
      : displayScore == null
        ? null
        : calculatePercentileFromBins(displayScore, percentile.bins);
  const assessmentLabel = scope === "mock" ? "mock" : "set";

  const bellCurve = useMemo(() => {
    const points = Array.from({ length: 121 }, (_, index) => {
      const ratio = index / 120;
      return {
        x: ratio * CHART_WIDTH,
        y: bellCurveY(ratio),
      };
    });
    const linePath = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    return {
      linePath,
      areaPath: `M 0 ${CHART_BASELINE} ${linePath.replace(/^M/, "L")} L ${CHART_WIDTH} ${CHART_BASELINE} Z`,
    };
  }, []);

  const position =
    displayScore == null
      ? CHART_WIDTH / 2
      : ((Math.min(range.max, Math.max(range.min, displayScore)) - range.min) /
          (range.max - range.min)) *
        CHART_WIDTH;
  const markerY = bellCurveY(position / CHART_WIDTH);

  const exploreAtPosition = (relativePosition: number) => {
    const rawScore = range.min + relativePosition * (range.max - range.min);
    setExploredScore(Math.round(rawScore / range.step) * range.step);
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    exploreAtPosition(
      Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = exploredScore ?? score ?? range.min;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setExploredScore(
      Math.min(range.max, Math.max(range.min, current + direction * range.step)),
    );
  };

  const explanation =
    percentile.status === "available"
      ? `Compared with ${percentile.cohortSize} Altitutor students using each student's first completed attempt at this ${assessmentLabel}.`
      : percentile.status === "insufficient_data"
        ? `A percentile will appear when at least ${percentile.minimumCohortSize} students have completed this ${assessmentLabel}.`
        : score == null
          ? `Complete this ${assessmentLabel} to see a percentile once enough students have also completed it.`
          : "Percentile data is unavailable right now.";

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardContent className="flex h-full flex-col gap-4 pt-6">
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
                <TooltipContent side="top" className="max-w-[300px]">
                  {explanation}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {percentile.status === "available" ? (
            <div className="mt-1 text-4xl font-bold tabular-nums">
              {formatPercentile(percentile.percentile)}
            </div>
          ) : percentile.status === "insufficient_data" ? (
            <div className="mt-1 text-2xl font-bold">Not enough data yet</div>
          ) : (
            <div className="mt-1 text-4xl font-bold text-muted-foreground">—</div>
          )}
        </div>

        {percentile.status === "available" && score != null ? (
          <div className="mt-auto min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">
                {exploredScore == null ? "Your position" : "Exploring"}
              </span>
              <span className="font-semibold tabular-nums">
                Score {displayScore} · {displayPercentile == null ? "—" : formatPercentile(displayPercentile)}
              </span>
            </div>

            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              tabIndex={0}
              aria-label={`Illustrative bell curve. Your score is ${score}, at the ${formatPercentile(percentile.percentile)} among ${percentile.cohortSize} first completed attempts.`}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setExploredScore(null)}
              onKeyDown={handleKeyDown}
              onBlur={() => setExploredScore(null)}
              className="mt-2 aspect-[4/1] h-auto w-full cursor-crosshair overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={position} height={CHART_HEIGHT} />
                </clipPath>
              </defs>
              <path d={bellCurve.areaPath} className="fill-muted/55" />
              <path
                d={bellCurve.areaPath}
                className="fill-primary/25"
                clipPath={`url(#${clipId})`}
              />
              <path
                d={bellCurve.linePath}
                fill="none"
                vectorEffect="non-scaling-stroke"
                className="stroke-primary/70"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="0"
                x2={CHART_WIDTH}
                y1={CHART_BASELINE}
                y2={CHART_BASELINE}
                vectorEffect="non-scaling-stroke"
                className="stroke-border"
                strokeWidth="1"
              />
              <line
                x1={position}
                x2={position}
                y1={markerY}
                y2={CHART_BASELINE}
                vectorEffect="non-scaling-stroke"
                className="stroke-foreground"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle
                cx={position}
                cy={markerY}
                r="5"
                className="fill-foreground stroke-background"
                strokeWidth="2"
              />
            </svg>
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>{range.min}</span>
              <span>{range.max}</span>
            </div>
          </div>
        ) : (
          <p className="mx-auto mt-auto max-w-sm text-center text-sm text-muted-foreground">
            {percentile.status === "insufficient_data"
              ? `${percentile.cohortSize} of ${percentile.minimumCohortSize} eligible first attempts so far.`
              : explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
