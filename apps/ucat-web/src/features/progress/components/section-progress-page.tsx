"use client";

import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useSectionProgress } from "../hooks/use-progress";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";
import { SetAttemptsCard } from "./set-attempts-card";
import { PracticeAttemptsCard } from "./practice-attempts-card";
import {
  Card,
  CardContent,
} from "@altitutor/ui";
import {
  UCAT_CARD_CHROME,
  UCAT_DIVIDER_TOP,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { getSectionProgressPercentage } from "../lib/progress-data-utils";
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";
import { PercentileCard } from "./percentile-card";
import { PredictedScoreCard } from "./predicted-score-card";
import type { SectionCategoryProgress } from "@altitutor/shared";

type SectionProgressPageProps = {
  sectionNumber: number;
};

export function SectionProgressPage({
  sectionNumber,
}: SectionProgressPageProps) {
  const { data, isLoading, error } = useSectionProgress(sectionNumber);
  const projectionQuery = useScoreProjection();
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
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}

function SectionProgressContent({
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
  backHref,
  backLabel,
}: {
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
  backHref: string;
  backLabel: string;
}) {
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
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={section.sectionName}
          description={`Progress for ${section.sectionName}`}
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={{ 1: section.sectionName }}
        />
      </motion.div>

      <motion.div className="flex flex-col gap-4" variants={itemVariants}>
        <div
          id="tour-section-predicted-score"
          className="grid gap-4 lg:grid-cols-2"
        >
          <PredictedScoreCard
            title="Predicted section score"
            tooltip="Predicted section score is based on your recent timed sets and mocks, with more weight given to timed performance."
            score={score}
            projection={scoreProjection}
          />
          <PercentileCard scaledScore={score} scope="section" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  className="text-accent shrink-0"
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
                  className="text-accent shrink-0"
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
                  className="text-accent shrink-0"
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
        <PracticeAttemptsCard sectionNumber={section.sectionNumber} />
      </motion.div>
      <motion.div id="tour-section-set-attempts" variants={itemVariants}>
        <SetAttemptsCard sectionNumber={section.sectionNumber} />
      </motion.div>
    </motion.div>
  );
}
