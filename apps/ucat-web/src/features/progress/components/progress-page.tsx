"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useProgressSummary } from "../hooks/use-progress";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type { TotalScoreProjection } from "@/features/score-projection/types/score-projection";
import { UCAT_CARD_CHROME, UCAT_CARD_CONTENT_AFTER_HEADER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { SectionProgressCards } from "./section-progress-cards";
import { ReviewHeatmapCard } from "./review-heatmap-card";
import { AnimatedInteger } from "./progress-animated-display";
import { ProgressGraph } from "./progress-graph";

export function ProgressPage() {
  const { data, isLoading, error } = useProgressSummary();
  const scoreProjectionQuery = useScoreProjection();

  const totalProjection = useMemo(() => {
    if (!scoreProjectionQuery.data) return null;
    return deriveTotalScoreProjection(scoreProjectionQuery.data.sections);
  }, [scoreProjectionQuery.data]);

  if (isLoading) {
    return <AppPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="Could not load your progress."
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="No progress data available."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div id="tour-progress-header">
        <UcatPageHeader
          title="Progress"
          description="A summary of your performance across UCAT sections."
        />
      </div>

      <TotalScoreProjectionCard
        projection={totalProjection}
        isLoading={scoreProjectionQuery.isLoading}
      />

      <ReviewHeatmapCard />

      <div id="tour-progress-sections">
        <SectionProgressCards
          sections={data.sectionProgress}
          linkToSection
          mode="all_time"
          timeFrameDays="30"
          scoreProjections={scoreProjectionQuery.data?.sections ?? []}
        />
      </div>
    </div>
  );
}

const COGNITIVE_SECTION_LABELS: Record<number, string> = {
  1: "Verbal Reasoning",
  2: "Decision Making",
  3: "Quantitative Reasoning",
};

type TotalScoreProjectionCardProps = {
  projection: TotalScoreProjection | null;
  isLoading: boolean;
};

function TotalScoreProjectionCard({
  projection,
  isLoading,
}: TotalScoreProjectionCardProps) {
  if (isLoading || projection == null) {
    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader>
          <CardTitle>Predicted UCAT score</CardTitle>
          <CardDescription>
            Loading score prediction from your section evidence.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (projection.currentEstimate == null) {
    const missingSections = projection.missingSectionNumbers
      .map((sectionNumber) => COGNITIVE_SECTION_LABELS[sectionNumber])
      .filter(Boolean)
      .join(", ");

    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader>
          <CardTitle>Predicted UCAT score</CardTitle>
          <CardDescription>
            Sum of Verbal Reasoning, Decision Making, and Quantitative
            Reasoning. Situational Judgement is excluded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <div className="text-sm font-semibold">Not enough evidence yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete enough weighted attempts in {missingSections} to show a
              total score prediction.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPoint = projection.projection.find((point) => point.day === 0);
  const currentDate =
    currentPoint?.date ?? new Date().toISOString().slice(0, 10);
  const historyData = projection.history.map((point) => ({
    date: point.date,
    value: point.value,
  }));
  const graphData = historyData.some((point) => point.date === currentDate)
    ? historyData
    : [
        ...historyData,
        {
          date: currentDate,
          value: projection.currentEstimate,
        },
      ];
  const graphProjection = {
    pessimistic: projection.projection.map((point) => ({
      date: point.date,
      value: point.pessimistic,
    })),
    realistic: projection.projection.map((point) => ({
      date: point.date,
      value: point.realistic,
    })),
    optimistic: projection.projection.map((point) => ({
      date: point.date,
      value: point.optimistic,
    })),
  };

  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Predicted UCAT score</CardTitle>
            <CardDescription>
              Historical estimates and future projection for Verbal Reasoning,
              Decision Making, and Quantitative Reasoning. Situational Judgement
              is excluded.
            </CardDescription>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-2xl font-bold tabular-nums">
              <AnimatedInteger value={projection.currentEstimate} />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {projection.confidence} confidence +/- {projection.uncertainty}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-5", UCAT_CARD_CONTENT_AFTER_HEADER)}>
        <ProgressGraph
          data={graphData}
          type="line"
          dataType="scaled_score"
          yAxisDomain={[900, 2700]}
          yAxisLabel="UCAT score"
          dateRangeLabel="Sections 1-3 only"
          projection={graphProjection}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projection.horizons.map((horizon) => (
            <div
              key={horizon.day}
              className="rounded-lg border border-border bg-card/50 p-3"
            >
              <div className="text-xs font-medium text-muted-foreground">
                {horizon.day} days
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {horizon.realistic}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {horizon.pessimistic} - {horizon.optimistic}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
