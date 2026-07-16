"use client";

import { useMemo } from "react";
import { Skeleton } from "@altitutor/ui";
import { lookupUcatAnzTotalPercentile } from "@altitutor/ucat-percentiles";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { todayIso } from "@/features/study-plan/lib/dates";
import { useProgressSummary } from "../hooks/use-progress";
import { ProgressTrajectoryCanvas } from "./progress-trajectory-canvas";
import { SectionProgressCards } from "./section-progress-cards";
import { ReviewActivityCalendarCard } from "./review-activity-calendar-card";
import type { SectionProgress } from "@altitutor/shared";
import type {
  SectionScoreProjection,
  TotalScoreProjection,
} from "@/features/score-projection/types/score-projection";
import type { UcatActivityResponse } from "@/app/api/ucat/activity/route";

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export type ProgressPageContentProps = {
  sections: SectionProgress[];
  scoreProjections: SectionScoreProjection[];
  totalProjection: TotalScoreProjection | null;
  targetScore: number | null;
  testDate: string | null;
  today: string;
  sectionTargets: Record<string, number>;
  activityPreviewData?: UcatActivityResponse;
  linkToSections?: boolean;
};

export function ProgressPage() {
  const progressQuery = useProgressSummary();
  const scoreProjectionQuery = useScoreProjection();
  const planQuery = useStudyPlan();

  const totalProjection = useMemo(
    () =>
      scoreProjectionQuery.data
        ? deriveTotalScoreProjection(scoreProjectionQuery.data.sections)
        : null,
    [scoreProjectionQuery.data],
  );

  if (progressQuery.isLoading || scoreProjectionQuery.isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-[620px] w-full" />
        <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 sm:px-6 lg:grid-cols-2">
          <Skeleton className="h-[280px] rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (progressQuery.error || !progressQuery.data) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <p className="mt-2 text-sm text-destructive">
          {progressQuery.error?.message ?? "No progress data is available."}
        </p>
      </div>
    );
  }

  const plan = planQuery.data;

  return (
    <ProgressPageContent
      sections={progressQuery.data.sectionProgress}
      scoreProjections={scoreProjectionQuery.data?.sections ?? []}
      totalProjection={totalProjection}
      targetScore={plan?.profile?.targetScore ?? null}
      testDate={plan?.profile?.testDate ?? null}
      today={plan?.today ?? todayIso()}
      sectionTargets={plan?.generation?.sectionTargets ?? {}}
    />
  );
}

export function ProgressPageContent({
  sections,
  scoreProjections,
  totalProjection,
  targetScore,
  testDate,
  today,
  sectionTargets,
  activityPreviewData,
  linkToSections = true,
}: ProgressPageContentProps) {
  const currentEstimate = totalProjection?.currentEstimate ?? null;
  const history = totalProjection?.history ?? [];
  const earliestRecent = history.length > 1 ? history[0] : null;
  const improvement =
    currentEstimate != null && earliestRecent
      ? Math.round(currentEstimate - earliestRecent.value)
      : null;
  const futurePoint = totalProjection?.projection.reduce(
    (nearest, point) =>
      Math.abs(point.day - 90) < Math.abs(nearest.day - 90) ? point : nearest,
    totalProjection.projection[0]!,
  );
  const projectedGain =
    currentEstimate != null && futurePoint
      ? Math.round(futurePoint.realistic - currentEstimate)
      : null;
  const benchmark = lookupUcatAnzTotalPercentile(currentEstimate);
  const targetBreakdown = scoreProjections
    .filter(
      (section) =>
        section.sectionNumber <= 3 &&
        sectionTargets[section.sectionId] != null,
    )
    .map((section) => ({
      sectionName: section.sectionName,
      target: sectionTargets[section.sectionId]!,
      currentEstimate: section.currentEstimate,
    }));
  const statusLabel =
    currentEstimate == null
      ? "Building baseline"
      : totalProjection?.confidence === "high"
        ? "Strong evidence"
        : totalProjection?.confidence === "medium"
          ? "Estimate forming"
          : "Early estimate";
  const insightTitle =
    improvement != null && improvement >= 20
      ? `Your estimate has improved by ${improvement} points`
      : projectedGain != null && projectedGain > 0
        ? `The current path adds about ${projectedGain} points over 90 days`
        : currentEstimate == null
          ? "Complete timed work in all three cognitive sections"
          : "Your estimate is the starting point—not the verdict";
  const insightBody =
    currentEstimate == null
      ? "A total trajectory appears once Verbal Reasoning, Decision Making and Quantitative Reasoning each have enough timed evidence."
      : benchmark.percentileLabel
        ? `Your ${currentEstimate} estimate is around the ${benchmark.percentileLabel.toLowerCase()} against the published UCAT ANZ benchmark. The shaded range shows what the current evidence can support, not a guaranteed result.`
        : "Keep adding timed evidence. The shaded range will narrow as the model sees more representative work across all three cognitive sections.";

  return (
    <div className="space-y-6 pb-8">
      <ProgressTrajectoryCanvas
        title="Score progress"
        description={
          targetScore != null
            ? `Current estimate ${currentEstimate ?? "—"} · Target ${targetScore}`
            : `Current estimate ${currentEstimate ?? "—"}`
        }
        statusLabel={statusLabel}
        projection={totalProjection}
        today={today}
        targetScore={targetScore}
        testDate={testDate}
        targetBreakdown={targetBreakdown}
        insightTitle={insightTitle}
        insightBody={insightBody}
        insightMeta={
          <div>
            <MetricRow
              label="Current estimate"
              value={currentEstimate == null ? "—" : String(currentEstimate)}
            />
            <MetricRow
              label="UCAT ANZ benchmark"
              value={benchmark.percentileLabel ?? "Not available yet"}
            />
            <MetricRow
              label="90-day change"
              value={
                projectedGain == null
                  ? "—"
                  : `${projectedGain >= 0 ? "+" : ""}${projectedGain}`
              }
            />
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 sm:px-6 lg:grid-cols-2 lg:items-start">
        <ReviewActivityCalendarCard
          className="h-full"
          previewData={activityPreviewData}
        />

        <section aria-label="Sections">
          <SectionProgressCards
            sections={sections}
            linkToSection={linkToSections}
            mode="all_time"
            timeFrameDays="30"
            scoreProjections={scoreProjections}
            sectionTargets={sectionTargets}
          />
        </section>
      </div>
    </div>
  );
}
