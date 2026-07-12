"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { AnimatedFraction, AnimatedInteger } from "./progress-animated-display";
import type { CategoryBreakdownEntry } from "../lib/compute-category-breakdown";

const SCALED_SCORE_TOOLTIP =
  "Scaled score (300–900) normalised to the UCAT exam scale for this section.";

export type AttemptReviewScoreCardProps = {
  title?: string;
  points: number;
  total: number;
  scaledScore?: number | null;
  categoryBreakdown?: CategoryBreakdownEntry[];
  /** When set, shown in the header (e.g. hover chevron). */
  headerAccessory?: ReactNode;
  className?: string;
  /** Extra classes for the card header when an accessory is present. */
  headerClassName?: string;
};

export function AttemptReviewScoreCard({
  title = "Score",
  points,
  total,
  scaledScore,
  categoryBreakdown = [],
  headerAccessory,
  className,
  headerClassName,
}: AttemptReviewScoreCardProps) {
  const showScaledScore = scaledScore !== undefined;

  return (
    <Card
      id="tour-attempt-score"
      className={cn(UCAT_CARD_CHROME, "h-full", className)}
    >
      <CardHeader className={cn("pb-2", headerClassName)}>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {headerAccessory}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {showScaledScore ? (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Scaled score</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help text-muted-foreground/80">
                      <Info
                        className="h-3.5 w-3.5"
                        aria-label="Scaled score explanation"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    {SCALED_SCORE_TOOLTIP}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "text-3xl font-bold tabular-nums",
                scaledScore == null && "text-muted-foreground",
              )}
            >
              {scaledScore != null ? (
                <AnimatedInteger value={Math.round(scaledScore)} />
              ) : (
                "—"
              )}
            </div>
          </div>
        ) : null}
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Points
          </div>
          <div className="text-xl font-semibold tabular-nums">
            {total > 0 ? (
              <AnimatedFraction numerator={points} denominator={total} />
            ) : (
              "—"
            )}
          </div>
        </div>
        {categoryBreakdown.length > 0 ? (
          <div className={cn(UCAT_DIVIDER_TOP, "mt-3 pt-3")}>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Category breakdown
            </div>
            <div className="flex flex-col gap-1.5">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.name}
                  className="flex justify-between text-sm tabular-nums"
                >
                  <span className="mr-2 truncate text-muted-foreground">
                    {cat.name}
                  </span>
                  <span className="shrink-0">
                    {cat.total > 0 ? (
                      <AnimatedFraction
                        numerator={cat.score}
                        denominator={cat.total}
                      />
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
