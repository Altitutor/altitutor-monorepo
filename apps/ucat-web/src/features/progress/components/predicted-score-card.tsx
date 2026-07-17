"use client";

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
  buildProjectionGraph,
  type ProjectionGraphSource,
} from "../lib/build-projection-graph";
import { AnimatedInteger } from "./progress-animated-display";
import { ProgressGraph } from "./progress-graph";

export type PredictedScoreProjectionSource = {
  currentEstimate: number | null;
  history: ProjectionGraphSource["history"];
  projection: ProjectionGraphSource["projection"];
};

export type PredictedScoreCardProps = {
  title: string;
  tooltip: string;
  score: number | null;
  /** Null while loading; present once projection data is available. */
  projection: PredictedScoreProjectionSource | null;
  emptyMessage?: string;
  yAxisDomain?: [number, number];
  className?: string;
};

export function PredictedScoreCard({
  title,
  tooltip,
  score,
  projection,
  emptyMessage = "Complete more timed sets or mocks for a prediction.",
  yAxisDomain,
  className,
}: PredictedScoreCardProps) {
  const estimate = projection?.currentEstimate ?? null;
  const hasEstimate = score != null && estimate != null;
  const graph =
    projection != null && estimate != null
      ? buildProjectionGraph({ ...projection, currentEstimate: estimate })
      : null;

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full", className)}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-base font-medium text-muted-foreground">
            <span>{title}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground/80">
                    <Info
                      className="h-3.5 w-3.5"
                      aria-label={`${title} explanation`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div
            className={cn(
              "mt-1 text-4xl font-bold tabular-nums",
              !hasEstimate && "text-muted-foreground",
            )}
          >
            {hasEstimate ? (
              <AnimatedInteger value={Math.round(score)} />
            ) : (
              "—"
            )}
          </div>
          {!hasEstimate && projection != null ? (
            <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
          ) : null}
        </div>

        {graph ? (
          <ProgressGraph
            compact
            data={graph.data}
            type="line"
            dataType="scaled_score"
            yAxisDomain={yAxisDomain}
            projection={graph.projection}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
