"use client";

import { useMemo } from "react";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_CARD_CONTENT_AFTER_HEADER, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  sumCorrectScoreFromAttempts,
  sumProgressPointsFromAttempts,
} from "@altitutor/shared";
import {
  getBestAttemptPerQuestion,
  getSectionProgressPercentage,
} from "../lib/progress-data-utils";
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";
import { formatUcatPercentile } from "../lib/percentiles";
import { ProgressGraph } from "./progress-graph";
import type {
  ProgressResponse,
  SectionCategoryProgress,
  QuestionAttemptRow,
  SetAttemptRow,
} from "@/app/api/ucat/progress/route";

type SectionProgressPageProps = {
  sectionNumber: number;
};

export function SectionProgressPage({ sectionNumber }: SectionProgressPageProps) {
  const { data, isLoading, error } = useSectionProgress(sectionNumber);
  const projectionQuery = useScoreProjection();
  const backHref = "/progress";
  const backLabel = "Back to progress";

  const sectionId = useMemo(() => {
    if (!data) return null;
    const section = data.sectionProgress.find(
      (s) => s.sectionNumber === sectionNumber,
    );
    return section?.sectionId ?? null;
  }, [data, sectionNumber]);

  const {
    section,
    categoryProgress,
    filteredQuestionAttempts,
    filteredSetAttempts,
  } = useMemo(() => {
    if (!data || sectionId == null) {
      return {
        section: null,
        categoryProgress: [] as SectionCategoryProgress[],
        filteredQuestionAttempts: [] as QuestionAttemptRow[],
        filteredSetAttempts: [] as SetAttemptRow[],
      };
    }
    const filteredQA = data.questionAttempts.filter(
      (a) => a.ucatSectionId === sectionId,
    );
    const filteredSA = data.setAttempts.filter(
      (a) => a.sectionId === sectionId,
    );
    const section =
      data.sectionProgress.find((s) => s.sectionId === sectionId) ?? null;
    if (!section) {
      return {
        section: null,
        categoryProgress: [] as SectionCategoryProgress[],
        filteredQuestionAttempts: filteredQA,
        filteredSetAttempts: filteredSA,
      };
    }

    const categoryProgress = data.sectionCategoryProgress?.[sectionId] ?? [];

    return {
      section,
      categoryProgress,
      filteredQuestionAttempts: filteredQA,
      filteredSetAttempts: filteredSA,
    };
  }, [data, sectionId]);

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
      totalPublicSets={data.totalPublicSetsBySection?.[section.sectionId]}
      totalPublicUntimedSets={
        data.totalPublicUntimedSetsBySection?.[section.sectionId]
      }
      totalPublicTimedSets={
        data.totalPublicTimedSetsBySection?.[section.sectionId]
      }
      filteredQuestionAttempts={filteredQuestionAttempts}
      filteredSetAttempts={filteredSetAttempts}
      practiceAttempts={data.practiceAttempts ?? []}
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
  filteredQuestionAttempts,
  filteredSetAttempts,
  practiceAttempts,
  categoryProgress,
  scoreProjection,
  backHref,
  backLabel,
}: {
  section: { sectionId: string; sectionName: string; sectionNumber: number };
  score: number | null;
  percentage: number;
  totalPublicQuestions?: number;
  totalPublicSets?: number;
  totalPublicUntimedSets?: number;
  totalPublicTimedSets?: number;
  filteredQuestionAttempts: QuestionAttemptRow[];
  filteredSetAttempts: SetAttemptRow[];
  practiceAttempts: NonNullable<ProgressResponse["practiceAttempts"]>;
  categoryProgress: SectionCategoryProgress[];
  scoreProjection: SectionScoreProjection | null;
  backHref: string;
  backLabel: string;
}) {
  const stats = useMemo(() => {
    const unique = getBestAttemptPerQuestion(filteredQuestionAttempts);
    const completed = sumProgressPointsFromAttempts(unique);
    const correct = sumCorrectScoreFromAttempts(unique);
    return {
      completed,
      correct,
      incorrect: completed - correct,
    };
  }, [filteredQuestionAttempts]);

  const setsStats = useMemo(() => {
    const nonStudentGenerated = filteredSetAttempts.filter(
      (a) => !a.isStudentGenerated,
    );
    const uniqueSetIds = new Set(
      nonStudentGenerated.map((a) => a.questionSetId),
    );
    const untimedCompleted = new Set(
      nonStudentGenerated
        .filter((a) => !a.wasTimed)
        .map((a) => a.questionSetId),
    );
    const timedCompleted = new Set(
      nonStudentGenerated.filter((a) => a.wasTimed).map((a) => a.questionSetId),
    );
    return {
      totalCompleted: uniqueSetIds.size,
      untimedCompleted: untimedCompleted.size,
      timedCompleted: timedCompleted.size,
    };
  }, [filteredSetAttempts]);
  const percentile = formatUcatPercentile(score, "section");

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={section.sectionName}
        description={`Progress for ${section.sectionName}`}
        backHref={backHref}
        backLabel={backLabel}
        breadcrumbOverrides={{ 1: section.sectionName }}
      />

      <div className="flex flex-col gap-4">
        <div id="tour-section-predicted-score" className="flex justify-center">
            <Card className={cn(UCAT_CARD_CHROME, "w-full max-w-xs")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-center">
                  Predicted section score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-4xl font-bold tabular-nums text-center",
                    score == null && "text-muted-foreground",
                  )}
                >
                  {score != null ? (
                    <AnimatedInteger value={Math.round(score)} />
                  ) : (
                    "—"
                  )}
                </div>
                {percentile ? (
                  <div className="mt-1 text-center text-xs font-medium text-muted-foreground">
                    {percentile}
                  </div>
                ) : null}
              </CardContent>
            </Card>
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
      </div>

      <div id="tour-section-score-projection">
        <ScoreProjectionCard projection={scoreProjection} />
      </div>

      <div id="tour-section-practice-attempts">
        <PracticeAttemptsCard attempts={practiceAttempts} />
      </div>
      <div id="tour-section-set-attempts">
        <SetAttemptsCard
          attempts={filteredSetAttempts}
          sectionNumber={section.sectionNumber}
        />
      </div>
    </div>
  );
}

function ScoreProjectionCard({
  projection,
}: {
  projection: SectionScoreProjection | null;
}) {
  if (!projection) {
    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader>
          <CardTitle>Score projection</CardTitle>
          <CardDescription>
            Projection will appear after your score estimate has loaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] rounded-lg bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  if (projection.currentEstimate == null) {
    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader>
          <CardTitle>Score projection</CardTitle>
          <CardDescription>
            Complete more timed sets or mocks before showing a predicted section
            score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <div className="text-2xl font-bold">Not enough evidence yet</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Current effective evidence weight is{" "}
              {projection.effectiveEvidenceWeight.toFixed(2)}. Once it reaches
              the configured threshold, this section will show a prediction and
              trajectory.
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
            <CardTitle>Score projection</CardTitle>
            <CardDescription>
              Estimate of your current and projected improvement, based on your historical performance and practice consistency.
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
          dateRangeLabel={`${projection.effectivePracticePerWeek} effective questions/week`}
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
