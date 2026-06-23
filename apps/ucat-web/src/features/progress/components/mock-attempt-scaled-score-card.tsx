"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { AnimatedInteger } from "./progress-animated-display";
import { formatUcatPercentile } from "../lib/percentiles";

type MockAttemptScaledScoreCardProps = {
  scaledScore: number | null;
};

export function MockAttemptScaledScoreCard({
  scaledScore,
}: MockAttemptScaledScoreCardProps) {
  const percentile = formatUcatPercentile(scaledScore, "mock");

  return (
    <div className="flex justify-center">
      <Card className={cn(UCAT_CARD_CHROME, "w-full max-w-xs")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-center">
            Overall scaled score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-4xl font-bold tabular-nums text-center",
              scaledScore == null && "text-muted-foreground",
            )}
          >
            {scaledScore != null ? (
              <AnimatedInteger value={Math.round(scaledScore)} />
            ) : (
              "—"
            )}
          </div>
          {percentile ? (
            <div className="mt-1 text-center text-xs font-medium text-muted-foreground">
              {percentile}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
