"use client";

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
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { AnimatedInteger } from "./progress-animated-display";
import { AttemptReviewTimingCard } from "./attempt-review-timing-card";
import type { AttemptReviewTimingMetrics } from "./attempt-review-timing-card";
import { PercentileCard } from "./percentile-card";
import type { CohortPercentileResult } from "@altitutor/ucat-percentiles";

type MockAttemptScoreTimingRowProps = {
  scaledScore: number | null;
  percentile: CohortPercentileResult;
  timing: AttemptReviewTimingMetrics;
};

export function MockAttemptScoreTimingRow({
  scaledScore,
  percentile,
  timing,
}: MockAttemptScoreTimingRowProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card id="tour-attempt-score" className={cn(UCAT_CARD_CHROME, "h-full")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Overall scaled score
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  Sum of scaled section scores for this mock (sections 1–3;
                  Situational Judgement excluded). Max is 900 per section.
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
        </CardContent>
      </Card>

      <PercentileCard
        scaledScore={scaledScore}
        percentile={percentile}
        scope="mock"
      />

      <AttemptReviewTimingCard timing={timing} scopeLabel="mock" />
    </div>
  );
}
