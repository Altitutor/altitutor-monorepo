"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useSectionProgress } from "../hooks/use-progress";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type {
  ScoreProjectionSnapshot,
  SectionScoreProjection,
} from "@/features/score-projection/types/score-projection";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { todayIso } from "@/features/study-plan/lib/dates";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import { sectionEstimateSnapshots } from "@/features/dashboard/lib/dashboard-trajectory";
import { useProgressSeries } from "../hooks/use-progress-series";
import { Card, CardContent } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { getSectionProgressPercentage } from "../lib/progress-data-utils";
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";
import type { SectionCategoryProgress } from "@altitutor/shared";
import { ProgressTrajectoryCanvas } from "./progress-trajectory-canvas";
import { SectionTimingCanvas } from "./section-timing-canvas";
import {
  AttemptHistoryExplorer,
  type AttemptHistoryPreviewData,
} from "./attempt-history-explorer";
import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import { buildSectionScoreInsight } from "../lib/score-insights";
import { SegmentedControl } from "./segmented-control";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SectionProgressPageProps = {
  sectionNumber: number;
};

const PRACTICE_METRICS = [
  { value: "percentage" as const, label: "Accuracy" },
  { value: "time_taken" as const, label: "Time taken" },
  { value: "attempt_count" as const, label: "Number of attempts" },
];

const SET_AND_MOCK_METRICS = [
  { value: "scaled_score" as const, label: "Scaled score" },
  { value: "percentage" as const, label: "Accuracy" },
  { value: "exam_speed" as const, label: "Exam speed" },
  { value: "time_taken" as const, label: "Time taken" },
];

const TRAJECTORY_VIEW_OPTIONS = [
  { value: "score" as const, label: "Score" },
  { value: "timing" as const, label: "Timing" },
];

export function SectionProgressPage({
  sectionNumber,
}: SectionProgressPageProps) {
  const { data, isLoading, error } = useSectionProgress(sectionNumber);
  const projectionQuery = useScoreProjection();
  const planQuery = useStudyPlan();
  const setSeriesQuery = useProgressSeries("set", sectionNumber);
  const backHref = "/progress";
  const backLabel = "Back to progress";

  const section = data?.section ?? null;
  const categoryProgress = data?.categoryProgress ?? [];

  if (isLoading) {
    return <AppPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="Could not load your progress."
          backHref={backHref}
          backLabel={backLabel}
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
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Section not found"
          description="This section could not be found."
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    );
  }

  const sectionProjection = projectionQuery.data
    ? (projectionQuery.data.sections.find(
        (s) => s.sectionNumber === section.sectionNumber,
      ) ?? null)
    : null;
  const score = projectionQuery.data
    ? (sectionProjection?.currentEstimate ?? null)
    : null;
  const examSpeedTotals = (setSeriesQuery.data?.points ?? []).reduce(
    (totals, point) => ({
      sum: totals.sum + point.examSpeedPercentSum,
      count: totals.count + point.examSpeedCount,
    }),
    { sum: 0, count: 0 },
  );
  const averageExamSpeed =
    examSpeedTotals.count > 0
      ? examSpeedTotals.sum / examSpeedTotals.count
      : null;
  const sectionTargets =
    planQuery.data?.generation?.sectionTargets ??
    (planQuery.data?.profile
      ? allocateSectionTargets(
          planQuery.data.profile.targetScore,
          (projectionQuery.data?.sections ?? [])
            .filter((item) => item.sectionNumber <= 3)
            .sort((left, right) => left.sectionNumber - right.sectionNumber)
            .map((item) => ({
              sectionId: item.sectionId,
              currentEstimate: item.currentEstimate,
            })),
        )
      : {});
  return (
    <SectionProgressContent
      section={section}
      score={score}
      percentage={getSectionProgressPercentage(section, "all_time")}
      totalPublicQuestions={section.totalPublicQuestions}
      totalPublicSets={data.totalPublicSets}
      totalPublicUntimedSets={data.totalPublicUntimedSets}
      totalPublicTimedSets={data.totalPublicTimedSets}
      setsCompleted={data.setsCompleted}
      untimedSetsCompleted={data.untimedSetsCompleted}
      timedSetsCompleted={data.timedSetsCompleted}
      categoryProgress={categoryProgress}
      scoreProjection={sectionProjection}
      snapshots={projectionQuery.data?.snapshots ?? []}
      targetScore={sectionTargets[section.sectionId] ?? null}
      testDate={planQuery.data?.profile?.testDate ?? null}
      today={planQuery.data?.today ?? todayIso()}
      averageExamSpeed={averageExamSpeed}
      timingSeries={setSeriesQuery.data?.points ?? []}
    />
  );
}

export type SectionProgressContentProps = {
  section: {
    sectionId: string;
    sectionName: string;
    sectionNumber: number;
    correctScore: number;
    maxScore: number;
  };
  score: number | null;
  percentage: number;
  totalPublicQuestions?: number;
  totalPublicSets?: number;
  totalPublicUntimedSets?: number;
  totalPublicTimedSets?: number;
  setsCompleted: number;
  untimedSetsCompleted: number;
  timedSetsCompleted: number;
  categoryProgress: SectionCategoryProgress[];
  scoreProjection: SectionScoreProjection | null;
  snapshots?: ScoreProjectionSnapshot[];
  targetScore: number | null;
  testDate: string | null;
  today: string;
  averageExamSpeed: number | null;
  timingSeries?: DailyProgressSeriesPoint[];
  attemptHistoryPreviewData?: Partial<
    Record<"practice" | "set" | "mock", AttemptHistoryPreviewData>
  >;
};

export function SectionProgressContent({
  section,
  score,
  percentage,
  totalPublicQuestions,
  totalPublicSets,
  totalPublicUntimedSets,
  totalPublicTimedSets,
  setsCompleted,
  untimedSetsCompleted,
  timedSetsCompleted,
  categoryProgress,
  scoreProjection,
  snapshots = [],
  targetScore,
  testDate,
  today,
  averageExamSpeed,
  timingSeries,
  attemptHistoryPreviewData,
}: SectionProgressContentProps) {
  const [trajectoryView, setTrajectoryView] = useState<"score" | "timing">(
    "score",
  );
  const stats = {
    completed: section.maxScore,
    correct: section.correctScore,
    incorrect: section.maxScore - section.correctScore,
  };

  const setsStats = {
    totalCompleted: setsCompleted,
    untimedCompleted: untimedSetsCompleted,
    timedCompleted: timedSetsCompleted,
  };
  const supportsScoreTarget = section.sectionNumber <= 3;
  const effectiveTargetScore = supportsScoreTarget ? targetScore : null;
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const weakestCategory = categoryProgress
    .filter((category) => category.maxScore > 0)
    .sort((left, right) => left.percentage - right.percentage)[0];
  const projectedGain =
    score != null && scoreProjection?.projection.length
      ? Math.round(scoreProjection.projection.at(-1)!.realistic - score)
      : null;
  const insight = buildSectionScoreInsight({
    sectionName: section.sectionName,
    score,
    projectedGain,
    weakestCategory: weakestCategory
      ? {
          name: weakestCategory.categoryName,
          accuracy: weakestCategory.percentage,
        }
      : null,
    averageExamSpeed,
  });
  const resolvedTimingSeries =
    timingSeries ?? attemptHistoryPreviewData?.set?.series ?? [];
  const trajectoryToggle = (
    <SegmentedControl
      value={trajectoryView}
      onValueChange={setTrajectoryView}
      options={TRAJECTORY_VIEW_OPTIONS}
      aria-label="Section progress view"
    />
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-6 sm:px-6">
        <UcatPageHeader
          title={section.sectionName}
          backHref="/progress"
          backLabel="Back to progress"
          actions={trajectoryToggle}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          id="tour-section-predicted-score"
          key={trajectoryView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {trajectoryView === "score" ? (
            <ProgressTrajectoryCanvas
              projection={scoreProjection}
              snapshots={sectionEstimateSnapshots(snapshots, section.sectionId)}
              today={today}
              targetScore={effectiveTargetScore}
              testDate={testDate}
              targetBreakdown={
                supportsScoreTarget
                  ? [
                      {
                        sectionName: section.sectionName,
                        target: effectiveTargetScore,
                        currentEstimate: score,
                      },
                    ]
                  : []
              }
              scoreMinimum={300}
              scoreMaximum={900}
              insightTitle={insight.title}
              insightBody={insight.body}
              insightRuleId={insight.ruleId}
              ratingContextKey={`progress:section:${section.sectionId}`}
              insightMeta={
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Current estimate
                      </span>
                      <span className="font-medium tabular-nums">
                        {score ?? "Pending"}
                      </span>
                    </div>
                    {supportsScoreTarget ? (
                      <>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Target</span>
                          {effectiveTargetScore == null ? (
                            <Link
                              href="/ucat-goal/setup"
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Set target
                            </Link>
                          ) : (
                            <span className="font-medium tabular-nums">
                              {effectiveTargetScore}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Gap</span>
                          <span className="font-medium tabular-nums">
                            {score == null || effectiveTargetScore == null
                              ? "Pending"
                              : effectiveTargetScore <= score
                                ? `${score - effectiveTargetScore} ahead`
                                : `${effectiveTargetScore - score} points`}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                  {setsCompleted === 0 ? (
                    <Button asChild className="mt-5 w-full">
                      <Link href={`/sets/sections/${section.sectionNumber}`}>
                        Go to sets
                      </Link>
                    </Button>
                  ) : null}
                </>
              }
            />
          ) : (
            <SectionTimingCanvas
              sectionName={section.sectionName}
              points={resolvedTimingSeries}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="mx-auto w-full max-w-[1400px] px-5 sm:px-6"
        variants={itemVariants}
      >
        <div
          id="tour-section-stats"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <Card className={UCAT_CARD_CHROME}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Questions correct
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    <AnimatedFraction
                      numerator={stats.correct}
                      denominator={stats.completed}
                    />
                  </span>
                </div>
                <ProgressCircular
                  percentage={stats.completed > 0 ? percentage : 0}
                  size={48}
                  className="shrink-0 text-primary"
                />
              </div>
              {categoryProgress.length > 0 ? (
                <div className={cn(UCAT_DIVIDER_TOP, "pt-3")}>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(() => {
                      const catsWithAttempts = categoryProgress.filter(
                        (c) => c.maxScore > 0,
                      );
                      const best =
                        catsWithAttempts.length > 0
                          ? catsWithAttempts.reduce((a, b) =>
                              a.percentage >= b.percentage ? a : b,
                            )
                          : null;
                      const worst =
                        catsWithAttempts.length > 1
                          ? catsWithAttempts.reduce((a, b) =>
                              a.percentage <= b.percentage ? a : b,
                            )
                          : null;
                      return categoryProgress.map((cat) => (
                        <div
                          key={cat.categoryId}
                          className="flex justify-between items-center text-sm tabular-nums gap-2"
                        >
                          <span className="text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
                            {cat === best && (
                              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                Best
                              </span>
                            )}
                            {cat === worst && cat !== best && (
                              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Worst
                              </span>
                            )}
                            {cat.categoryName}
                          </span>
                          <span className="shrink-0">
                            {cat.maxScore > 0 ? (
                              <AnimatedFraction
                                numerator={cat.correctScore}
                                denominator={cat.maxScore}
                              />
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className={UCAT_CARD_CHROME}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Total questions completed
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    <AnimatedInteger value={stats.completed} />
                    {totalPublicQuestions != null ? (
                      <>
                        {" / "}
                        <span className="tabular-nums">
                          {totalPublicQuestions}
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>
                <ProgressCircular
                  percentage={
                    totalPublicQuestions != null && totalPublicQuestions > 0
                      ? Math.round(
                          (stats.completed / totalPublicQuestions) * 100,
                        )
                      : stats.completed > 0
                        ? 100
                        : 0
                  }
                  size={48}
                  className="shrink-0 text-primary"
                />
              </div>
              {categoryProgress.length > 0 ? (
                <div className={cn(UCAT_DIVIDER_TOP, "pt-3")}>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {categoryProgress.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="flex justify-between text-sm tabular-nums"
                      >
                        <span className="text-muted-foreground truncate mr-2">
                          {cat.categoryName}
                        </span>
                        <span className="shrink-0">
                          {cat.totalPublicQuestions != null ? (
                            <AnimatedFraction
                              numerator={cat.maxScore}
                              denominator={cat.totalPublicQuestions}
                            />
                          ) : (
                            `${cat.maxScore} questions`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className={UCAT_CARD_CHROME}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Total sets completed
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    <AnimatedInteger value={setsStats.totalCompleted} />
                    {totalPublicSets != null ? (
                      <>
                        {" / "}
                        <span className="tabular-nums">{totalPublicSets}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <ProgressCircular
                  percentage={
                    totalPublicSets != null && totalPublicSets > 0
                      ? Math.round(
                          (setsStats.totalCompleted / totalPublicSets) * 100,
                        )
                      : setsStats.totalCompleted > 0
                        ? 100
                        : 0
                  }
                  size={48}
                  className="shrink-0 text-primary"
                />
              </div>
              <div className={cn(UCAT_DIVIDER_TOP, "pt-3")}>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Breakdown
                </div>
                <div className="flex flex-col gap-1.5 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Untimed sets completed
                    </span>
                    <span className="shrink-0">
                      <AnimatedInteger value={setsStats.untimedCompleted} />
                      {totalPublicUntimedSets != null ? (
                        <>
                          {" / "}
                          <span className="tabular-nums">
                            {totalPublicUntimedSets}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Timed sets completed
                    </span>
                    <span className="shrink-0">
                      <AnimatedInteger value={setsStats.timedCompleted} />
                      {totalPublicTimedSets != null ? (
                        <>
                          {" / "}
                          <span className="tabular-nums">
                            {totalPublicTimedSets}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div id="tour-section-practice-attempts" variants={itemVariants}>
        <AttemptHistoryExplorer
          source="practice"
          title="Practice sessions"
          sectionNumber={section.sectionNumber}
          defaultMetric="percentage"
          metricOptions={PRACTICE_METRICS}
          previewData={attemptHistoryPreviewData?.practice}
          emptyActionHref="/practice"
          emptyActionLabel="Go to practice"
        />
      </motion.div>
      <motion.div id="tour-section-set-attempts" variants={itemVariants}>
        <AttemptHistoryExplorer
          source="set"
          title="Set attempts"
          sectionNumber={section.sectionNumber}
          defaultMetric="scaled_score"
          metricOptions={SET_AND_MOCK_METRICS}
          previewData={attemptHistoryPreviewData?.set}
          emptyActionHref={`/sets/sections/${section.sectionNumber}`}
          emptyActionLabel="Go to sets"
        />
      </motion.div>
    </motion.div>
  );
}
