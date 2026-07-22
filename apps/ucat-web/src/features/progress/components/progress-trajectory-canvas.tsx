"use client";

import type { ReactNode } from "react";
import { Badge } from "@altitutor/ui";
import { Sparkles } from "lucide-react";
import {
  DashboardTrajectoryChart,
  type DashboardTargetBreakdown,
} from "@/features/dashboard/components/dashboard-trajectory-chart";
import type { DashboardTrajectoryChartPoint } from "@/features/dashboard/lib/dashboard-trajectory";
import {
  buildDashboardTrajectoryChartData,
  DASHBOARD_FORECAST_WINDOW_DAYS,
} from "@/features/dashboard/lib/dashboard-trajectory";
import { UCAT_FLOATING_GRAPH_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type {
  ProjectionPoint,
  ScoreProjectionSnapshot,
} from "@/features/score-projection/types/score-projection";
import { daysBetween } from "@/features/study-plan/lib/dates";
import { ContentRatingControls } from "@/features/content-ratings/components/content-rating-controls";
import { contentSnapshotVersion } from "@/features/content-ratings/lib";

export type ProgressTrajectorySource = {
  currentEstimate: number | null;
  projection: ProjectionPoint[];
};

export function buildProgressTrajectoryData(
  source: ProgressTrajectorySource | null,
  today: string,
  highlightedPoint?: ProjectionPoint | null,
  snapshots: ScoreProjectionSnapshot[] = [],
): DashboardTrajectoryChartPoint[] {
  if (!source || source.currentEstimate == null) return [];
  return buildDashboardTrajectoryChartData(
    {
      currentEstimate: source.currentEstimate,
      confidence: "medium",
      uncertainty: 0,
      effectiveEvidenceWeight: 0,
      missingSectionNumbers: [],
      history: [],
      projection: source.projection,
      horizons: [],
    },
    today,
    highlightedPoint,
    snapshots,
  );
}

type ProgressTrajectoryCanvasProps = {
  title?: string;
  description?: string;
  statusLabel?: string;
  projection: ProgressTrajectorySource | null;
  /** Persisted estimate snapshots (total or section-projected) for the actual line. */
  snapshots?: ScoreProjectionSnapshot[];
  today: string;
  targetScore: number | null;
  testDate: string | null;
  targetBreakdown?: DashboardTargetBreakdown[];
  scoreMinimum?: number;
  scoreMaximum?: number;
  insightTitle: string;
  insightBody: string;
  ratingTargetKey: string;
  ratingContextKey: string;
  insightMeta?: ReactNode;
  headerControl?: ReactNode;
};

export function ProgressTrajectoryCanvas({
  title,
  description,
  statusLabel,
  projection,
  snapshots = [],
  today,
  targetScore,
  testDate,
  targetBreakdown = [],
  scoreMinimum = 900,
  scoreMaximum = 2700,
  insightTitle,
  insightBody,
  ratingTargetKey,
  ratingContextKey,
  insightMeta,
  headerControl,
}: ProgressTrajectoryCanvasProps) {
  const chartData = buildProgressTrajectoryData(
    projection,
    today,
    null,
    snapshots,
  );
  const hasEstimate = projection?.currentEstimate != null;
  const testDay = testDate ? daysBetween(today, testDate) : null;
  const showTestMarker =
    hasEstimate &&
    testDay != null &&
    testDay >= 0 &&
    testDay <= DASHBOARD_FORECAST_WINDOW_DAYS;
  const displayedContent = { title: insightTitle, body: insightBody };
  const hasHeader = Boolean(
    title || description || statusLabel || headerControl,
  );
  const ratingControls = (
    <ContentRatingControls
      className="mt-3"
      descriptor={{
        targetType: "progress_insight",
        targetKey: ratingTargetKey,
        targetVersion: contentSnapshotVersion(displayedContent),
        contextKey: ratingContextKey,
        surface: "progress",
        displayedContent,
      }}
    />
  );

  return (
    <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background">
      <div
        className={cn(
          "relative",
          hasHeader
            ? "min-h-[680px] sm:min-h-[650px] lg:min-h-[620px]"
            : "min-h-[560px] sm:min-h-[560px] lg:min-h-[560px]",
        )}
      >
        {hasHeader ? (
          <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-start justify-between gap-4 px-5 py-6 sm:flex-row sm:px-8 lg:px-10">
            {title || description ? (
              <div>
                {title ? (
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
            ) : (
              <div />
            )}
            <div className="flex shrink-0 flex-col-reverse items-start gap-2 sm:items-end">
              {headerControl}
              {statusLabel ? (
                <Badge variant="secondary">{statusLabel}</Badge>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "absolute inset-x-0 min-w-0",
            hasHeader ? "top-44 sm:top-28 lg:top-20" : "top-4 sm:top-6",
          )}
        >
          <DashboardTrajectoryChart
            mode={hasEstimate ? "forecast" : "baseline"}
            data={chartData}
            targetScore={targetScore}
            currentEstimate={projection?.currentEstimate ?? null}
            today={today}
            testDate={testDate}
            showTestMarker={showTestMarker}
            targetBreakdown={targetBreakdown}
            scoreMinimum={scoreMinimum}
            scoreMaximum={scoreMaximum}
            className="h-[400px] sm:h-[480px] lg:h-[520px]"
          />
        </div>

        <aside
          className={cn(
            UCAT_FLOATING_GRAPH_CARD,
            "absolute right-6 z-20 hidden w-[min(390px,calc(100%-3rem))] p-6 lg:block",
            hasHeader ? "top-24" : "top-6",
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            Score insight
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">
            {insightTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {insightBody}
          </p>
          {ratingControls}
          {insightMeta ? (
            <div className="mt-5 border-t border-border/60 pt-4">
              {insightMeta}
            </div>
          ) : null}
        </aside>
      </div>

      <aside
        className={cn(
          UCAT_FLOATING_GRAPH_CARD,
          "relative z-20 mx-4 -mt-20 mb-5 p-5 lg:hidden",
        )}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          Score insight
        </div>
        <h2 className="mt-2 text-lg font-semibold">{insightTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{insightBody}</p>
        {ratingControls}
        {insightMeta ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            {insightMeta}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
