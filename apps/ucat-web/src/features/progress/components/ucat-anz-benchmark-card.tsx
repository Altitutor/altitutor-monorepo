import React from "react";
import { Info } from "lucide-react";
import { lookupUcatAnzTotalPercentile } from "@altitutor/ucat-percentiles";
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

type UcatAnzBenchmarkCardProps = {
  score: number | null | undefined;
  className?: string;
};

export function UcatAnzBenchmarkCard({
  score,
  className,
}: UcatAnzBenchmarkCardProps) {
  const benchmark = lookupUcatAnzTotalPercentile(score);
  const candidateCount = benchmark.candidateCount.toLocaleString("en-AU");

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardContent className="flex h-full flex-col items-center justify-center gap-3 pt-6 text-center">
        <div className="flex items-center gap-1.5 text-base font-medium text-muted-foreground">
          <span>UCAT ANZ benchmark</span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground/80">
                  <Info
                    className="h-3.5 w-3.5"
                    aria-label="UCAT ANZ benchmark explanation"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[310px]">
                Estimated from the published 2025 UCAT ANZ total-score deciles.
                This is a real-exam benchmark, not an Altitutor student ranking.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className={cn(
            "text-3xl font-bold tabular-nums",
            benchmark.percentileLabel == null && "text-muted-foreground",
          )}
        >
          {benchmark.percentileLabel ?? "—"}
        </div>

        <p className="max-w-sm text-sm text-muted-foreground">
          {benchmark.percentileLabel == null
            ? "A benchmark will appear when a total score is available."
            : `Estimated against ${candidateCount} candidates who sat UCAT ANZ in ${benchmark.year}.`}
        </p>
      </CardContent>
    </Card>
  );
}
