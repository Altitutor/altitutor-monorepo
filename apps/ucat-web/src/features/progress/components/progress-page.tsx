"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
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
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import type { SectionProgress } from "@altitutor/shared";
import type {
  ScoreProjectionSnapshot,
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
  const hasPublicTotals = sections.some(
    (section) => section.totalPublicQuestions != null,
  );
  const totalAvailable = hasPublicTotals
    ? sections.reduce(
        (sum, section) => sum + (section.totalPublicQuestions ?? 0),
        0,
      )
    : null;
  const percentage =
    totalAvailable != null && totalAvailable > 0
      ? Math.round((totalCompleted / totalAvailable) * 100)
      : totalCompleted > 0
        ? 100
        : 0;

  return (
    <Card className={cn(UCAT_CARD_CHROME, className)}>
      <CardContent className="flex h-full flex-col gap-4 pt-6">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-base font-medium text-muted-foreground">
              Total questions completed
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {totalAvailable != null ? (
                <AnimatedFraction
                  numerator={totalCompleted}
                  denominator={totalAvailable}
                />
              ) : (
                <AnimatedInteger value={totalCompleted} />
              )}
            </span>
          </div>
          <ProgressCircular
            percentage={percentage}
            size={48}
            className="shrink-0 text-primary"
          />
        </div>
        <div className={cn(UCAT_DIVIDER_TOP, "pt-3")}>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Section breakdown
          </div>
          <div className="flex flex-col gap-1.5">
            {sections.map((section) => (
              <div
                key={section.sectionId}
                className="flex justify-between gap-3 text-sm tabular-nums"
              >
                <span className="mr-2 truncate text-muted-foreground">
                  {section.sectionName}
                </span>
                <span className="shrink-0">
                  {section.totalPublicQuestions != null ? (
                    <AnimatedFraction
                      numerator={section.maxScore}
                      denominator={section.totalPublicQuestions}
                    />
                  ) : (
                    `${section.maxScore} questions`
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type ProgressPageContentProps = {
  sections: SectionProgress[];
  scoreProjections: SectionScoreProjection[];
  totalProjection: TotalScoreProjection | null;
  snapshots?: ScoreProjectionSnapshot[];
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
          <Skeleton className="h-[320px] rounded-2xl" />
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
      snapshots={scoreProjectionQuery.data?.snapshots ?? []}
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
  snapshots = [],
  targetScore,
  testDate,
  today,
  sectionTargets,
  activityPreviewData,
  linkToSections = true,
  mockRecentWeightedAverage = null,
}: ProgressPageContentProps) {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const currentEstimate = totalProjection?.currentEstimate ?? null;
  const history = snapshots.map((snapshot) => ({
    date: snapshot.date,
    value: snapshot.currentEstimate,
  }));
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
    .filter((section) => section.sectionNumber <= 3)
    .map((section) => ({
      sectionName: section.sectionName,
      target: sectionTargets[section.sectionId] ?? null,
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
        ? `Your score is predicted to improve by about ${projectedGain} points over the next 90 days`
        : currentEstimate == null
          ? "Build your baseline one section at a time"
          : "Your estimate is the starting point - not the verdict";
  const insightBody =
    currentEstimate == null
      ? "Complete one timed set in each cognitive section to build a score estimate."
      : benchmark.percentileLabel
        ? `Your ${currentEstimate} estimate is around the ${benchmark.percentileLabel.toLowerCase()} against the published UCAT ANZ benchmark. The shaded range shows what the current evidence can support, not a guaranteed result.`
        : "Keep adding timed evidence. The shaded range will narrow as the model sees more representative work across Sections 1–3.";

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div id="tour-progress-predicted-score" variants={itemVariants}>
        <ProgressTrajectoryCanvas
          title="Score progress"
          description={
            targetScore != null
              ? `Current estimate ${currentEstimate ?? "pending"} · Target ${targetScore}`
              : `Current estimate ${currentEstimate ?? "pending"}`
          }
          statusLabel={statusLabel}
          projection={totalProjection}
          snapshots={snapshots}
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
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mx-auto grid w-full max-w-[1400px] grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5 px-5 sm:px-6"
      >
        <div id="tour-progress-activity">
          <ReviewActivityCalendarCard
            className="h-full"
            previewData={activityPreviewData}
          />
        </div>

        <section
          id="tour-progress-sections"
          aria-label="Sections"
          className="min-w-0"
        >
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
        <div id="tour-progress-questions-completed">
          <QuestionsCompletedCard sections={sections} className="h-full" />
        </div>
      </motion.div>
    </motion.div>
  );
}
