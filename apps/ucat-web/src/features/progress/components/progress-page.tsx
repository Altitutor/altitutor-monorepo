"use client";

import { useMemo } from "react";
import { Card, CardContent, Skeleton } from "@altitutor/ui";
import { lookupUcatAnzTotalPercentile } from "@altitutor/ucat-percentiles";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { todayIso } from "@/features/study-plan/lib/dates";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import { useProgressSummary } from "../hooks/use-progress";
import { useProgressSeries } from "../hooks/use-progress-series";
import { calculateRecentWeightedMockScore } from "../lib/mock-progress-insights";
import { ProgressTrajectoryCanvas } from "./progress-trajectory-canvas";
import { SectionProgressCards } from "./section-progress-cards";
import { ReviewActivityCalendarCard } from "./review-activity-calendar-card";
import { AnimatedInteger, ProgressCircular } from "./progress-animated-display";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
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

function QuestionsCompletedCard({
  sections,
  className,
}: {
  sections: SectionProgress[];
  className?: string;
}) {
  const totalCompleted = sections.reduce(
    (sum, section) => sum + section.maxScore,
    0,
  );
  const totals = sections.map((section) => section.totalPublicQuestions);
  const totalAvailable = totals.every((total) => total != null)
    ? totals.reduce<number>((sum, total) => sum + (total ?? 0), 0)
    : null;
  const percentage =
    totalAvailable != null && totalAvailable > 0
      ? Math.round((totalCompleted / totalAvailable) * 100)
      : totalCompleted > 0
        ? 100
        : 0;

  return (
    <Card className={cn(UCAT_CARD_CHROME, className)}>
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-medium text-muted-foreground">
              Total questions completed
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              <AnimatedInteger value={totalCompleted} />
              {totalAvailable != null ? ` / ${totalAvailable}` : null}
            </p>
          </div>
          <ProgressCircular
            percentage={percentage}
            size={48}
            className="shrink-0 text-accent"
          />
        </div>
        <div className={cn(UCAT_DIVIDER_TOP, "space-y-1.5 pt-3")}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Section breakdown
          </p>
          {sections.map((section) => (
            <div
              key={section.sectionId}
              className="flex justify-between gap-3 text-sm tabular-nums"
            >
              <span className="truncate text-muted-foreground">
                {section.sectionName}
              </span>
              <span className="shrink-0 font-medium">
                {section.maxScore}
                {section.totalPublicQuestions != null
                  ? ` / ${section.totalPublicQuestions}`
                  : " questions"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
  mockRecentWeightedAverage?: number | null;
};

export function ProgressPage() {
  const progressQuery = useProgressSummary();
  const scoreProjectionQuery = useScoreProjection();
  const planQuery = useStudyPlan();
  const mockSeriesQuery = useProgressSeries("mock");

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
  const sectionTargets =
    plan?.generation?.sectionTargets ??
    (plan?.profile
      ? allocateSectionTargets(
          plan.profile.targetScore,
          (scoreProjectionQuery.data?.sections ?? [])
            .filter((section) => section.sectionNumber <= 3)
            .sort((left, right) => left.sectionNumber - right.sectionNumber)
            .map((section) => ({
              sectionId: section.sectionId,
              currentEstimate: section.currentEstimate,
            })),
        )
      : {});

  return (
    <ProgressPageContent
      sections={progressQuery.data.sectionProgress}
      scoreProjections={scoreProjectionQuery.data?.sections ?? []}
      totalProjection={totalProjection}
      targetScore={plan?.profile?.targetScore ?? null}
      testDate={plan?.profile?.testDate ?? null}
      today={plan?.today ?? todayIso()}
      sectionTargets={sectionTargets}
      mockRecentWeightedAverage={calculateRecentWeightedMockScore(
        mockSeriesQuery.data?.points ?? [],
      )}
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
  mockRecentWeightedAverage = null,
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
        section.sectionNumber <= 3 && sectionTargets[section.sectionId] != null,
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
          ? "Build your baseline one section at a time"
          : "Your estimate is the starting point - not the verdict";
  const insightBody =
    currentEstimate == null
      ? "Complete one representative timed set in each cognitive section. Keep your usual method and pace so the first comparison reflects how you currently work."
      : benchmark.percentileLabel
        ? `Your ${currentEstimate} estimate is around the ${benchmark.percentileLabel.toLowerCase()} against the published UCAT ANZ benchmark. The shaded range shows what the current evidence can support, not a guaranteed result.`
        : "Keep adding timed evidence. The shaded range will narrow as the model sees more representative work across Sections 1–3.";

  return (
    <div className="space-y-6 pb-8">
      <ProgressTrajectoryCanvas
        title="Score progress"
        description={
          targetScore != null
            ? `Current estimate ${currentEstimate ?? "pending"} · Target ${targetScore}`
            : `Current estimate ${currentEstimate ?? "pending"}`
        }
        statusLabel={statusLabel}
        projection={totalProjection}
        today={today}
        targetScore={targetScore}
        testDate={testDate}
        targetBreakdown={targetBreakdown}
        insightTitle={insightTitle}
        insightBody={insightBody}
        ratingTargetKey="total-score-trajectory"
        ratingContextKey="progress:total-score"
        insightMeta={
          <div>
            <MetricRow
              label="Current estimate"
              value={
                currentEstimate == null ? "Pending" : String(currentEstimate)
              }
            />
            <MetricRow
              label="UCAT ANZ benchmark"
              value={benchmark.percentileLabel ?? "Not available yet"}
            />
            {projectedGain != null ? (
              <MetricRow
                label="90-day change"
                value={`${projectedGain >= 0 ? "+" : ""}${projectedGain}`}
              />
            ) : null}
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-5 sm:px-6 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
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
            mockRecentWeightedAverage={mockRecentWeightedAverage}
            mockTargetScore={targetScore}
          />
        </section>
        <QuestionsCompletedCard
          sections={sections}
          className="h-full md:col-span-2 xl:col-span-1"
        />
      </div>
    </div>
  );
}
