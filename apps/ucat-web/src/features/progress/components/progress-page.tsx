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
import { useProgress } from "../hooks/use-progress";
import { useProgressMode } from "../hooks/use-progress-mode";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type { TotalScoreProjection } from "@/features/score-projection/types/score-projection";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { ProgressModeFloatingToolbar } from "./progress-mode-floating-toolbar";
import { SectionProgressCards } from "./section-progress-cards";
import { SetAttemptsCard } from "./set-attempts-card";
import { MockAttemptsCard } from "./mock-attempts-card";
import { PracticeAttemptsCard } from "./practice-attempts-card";
import { QuestionAttemptsCard } from "./question-attempts-card";
import { ReviewHeatmapCard } from "./review-heatmap-card";
import { AnimatedInteger } from "./progress-animated-display";
import { ProgressGraph } from "./progress-graph";
import {
  filterByTimeFrame,
  computeSectionProgressFromFiltered,
  getSharedDateRange,
  applyAttemptFilterToProgress,
} from "../lib/progress-data-utils";

export function ProgressPage() {
  const { data, isLoading, error } = useProgress();
  const scoreProjectionQuery = useScoreProjection();
  const progressMode = useProgressMode();

  const filteredData = useMemo(() => {
    if (!data) return null;
    return applyAttemptFilterToProgress(data, progressMode.attemptFilter);
  }, [data, progressMode.attemptFilter]);

  const sectionProgress = useMemo(() => {
    if (!filteredData) return [];
    const { mode, timeFrameDays } = progressMode;
    if (mode !== "time_frame") return filteredData.sectionProgress;
    const filteredQA = filterByTimeFrame(
      filteredData.questionAttempts,
      mode,
      timeFrameDays,
    );
    const filteredSA = filterByTimeFrame(
      filteredData.setAttempts,
      mode,
      timeFrameDays,
    );
    return computeSectionProgressFromFiltered(
      filteredQA,
      filteredSA,
      filteredData.sectionProgress,
    );
  }, [filteredData, progressMode]);

  const sharedDateRange = useMemo(() => {
    if (!filteredData) return undefined;
    return getSharedDateRange(
      filteredData.questionAttempts,
      filteredData.setAttempts,
      filteredData.mockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays,
    );
  }, [filteredData, progressMode.mode, progressMode.timeFrameDays]);

  const totalProjection = useMemo(() => {
    if (!scoreProjectionQuery.data) return null;
    return deriveTotalScoreProjection(scoreProjectionQuery.data.sections);
  }, [scoreProjectionQuery.data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="Loading your progress..."
        />
        <div className="animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    );
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

  if (!data || !filteredData) {
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
    <div className="relative space-y-6 pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]">
      <div id="tour-progress-header">
        <UcatPageHeader
          title="Progress"
          description="Track your performance across sections, set attempts, and mock exams."
        />
      </div>

      <TotalScoreProjectionCard
        projection={totalProjection}
        isLoading={scoreProjectionQuery.isLoading}
      />

      <ReviewHeatmapCard />

      <SectionProgressCards
        sections={sectionProgress}
        linkToSection
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        scoreProjections={scoreProjectionQuery.data?.sections ?? []}
      />
      <QuestionAttemptsCard
        attempts={filteredData.questionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
      <SetAttemptsCard
        attempts={filteredData.setAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
      <PracticeAttemptsCard
        attempts={filteredData.practiceAttempts ?? []}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <MockAttemptsCard
        attempts={filteredData.mockAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />

      <ProgressModeFloatingToolbar
        tourAnchorId="tour-progress-mode"
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        attemptFilter={progressMode.attemptFilter}
        onAttemptFilterChange={progressMode.onAttemptFilterChange}
      />
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
              Sum of Verbal Reasoning, Decision Making, and Quantitative
              Reasoning. Situational Judgement is excluded.
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
      <CardContent className="space-y-5">
        <ProgressGraph
          data={[
            {
              date: currentDate,
              value: projection.currentEstimate,
            },
          ]}
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
