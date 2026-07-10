"use client";

import { useMemo } from "react";
import { UcatPageHeader } from "@/features/layout";
import { useProgress } from "../hooks/use-progress";
import { useProgressMode } from "../hooks/use-progress-mode";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";
import { ProgressModeFloatingToolbar } from "./progress-mode-floating-toolbar";
import { SetAttemptsCard } from "./set-attempts-card";
import { QuestionAttemptsCard } from "./question-attempts-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  sumCorrectScoreFromAttempts,
  sumProgressPointsFromAttempts,
} from "@altitutor/shared";
import {
  filterByTimeFrame,
  computeSingleSectionFromFiltered,
  computeCategoryProgressFromFiltered,
  getBestAttemptPerQuestion,
  applyAttemptFilterToProgress,
  getSharedDateRange,
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
  SectionCategoryProgress,
  QuestionAttemptRow,
  SetAttemptRow,
} from "@/app/api/ucat/progress/route";

type SectionProgressPageProps = {
  sectionNumber: number;
  /** When true, only mock set attempts are included and UI reflects mocks-only context */
  mocksOnly?: boolean;
};

export function SectionProgressPage({
  sectionNumber,
  mocksOnly = false,
}: SectionProgressPageProps) {
  const { data, isLoading, error } = useProgress();
  const projectionQuery = useScoreProjection(!mocksOnly);
  const progressMode = useProgressMode();
  const backHref = mocksOnly ? "/progress/mocks" : "/progress";
  const backLabel = mocksOnly ? "Back to mock progress" : "Back to progress";

  const sectionId = useMemo(() => {
    if (!data) return null;
    const section = data.sectionProgress.find(
      (s) => s.sectionNumber === sectionNumber,
    );
    return section?.sectionId ?? null;
  }, [data, sectionNumber]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const filter = mocksOnly ? "mocks_only" : progressMode.attemptFilter;
    return applyAttemptFilterToProgress(data, filter);
  }, [data, progressMode.attemptFilter, mocksOnly]);

  const {
    section,
    categoryProgress,
    filteredQuestionAttempts,
    filteredSetAttempts,
    sharedDateRange,
  } = useMemo(() => {
    if (!filteredData || sectionId == null) {
      return {
        section: null,
        categoryProgress: [] as SectionCategoryProgress[],
        filteredQuestionAttempts: [] as QuestionAttemptRow[],
        filteredSetAttempts: [] as SetAttemptRow[],
        sharedDateRange: undefined,
      };
    }
    const { mode, timeFrameDays } = progressMode;
    const filteredQA = filteredData.questionAttempts.filter(
      (a) => a.ucatSectionId === sectionId,
    );
    const filteredSA = filteredData.setAttempts.filter(
      (a) => a.sectionId === sectionId,
    );
    const timeFilteredQA = filterByTimeFrame(filteredQA, mode, timeFrameDays);
    const timeFilteredSA = filterByTimeFrame(filteredSA, mode, timeFrameDays);

    const baseSection = filteredData.sectionProgress.find(
      (s) => s.sectionId === sectionId,
    );
    const section =
      mode === "time_frame" && baseSection
        ? computeSingleSectionFromFiltered(
            timeFilteredQA,
            timeFilteredSA,
            baseSection,
          )
        : (baseSection ?? null);
    if (!section) {
      return {
        section: null,
        categoryProgress: [] as SectionCategoryProgress[],
        filteredQuestionAttempts: filteredQA,
        filteredSetAttempts: filteredSA,
        sharedDateRange: getSharedDateRange(
          filteredData.questionAttempts,
          filteredData.setAttempts,
          filteredData.mockAttempts,
          mode,
          timeFrameDays,
        ),
      };
    }

    const categoryProgress =
      mode === "time_frame"
        ? (computeCategoryProgressFromFiltered(
            timeFilteredQA,
            filteredData.sectionCategoryProgress ?? {},
          )[sectionId] ?? [])
        : (filteredData.sectionCategoryProgress?.[sectionId] ?? []);

    return {
      section,
      categoryProgress,
      filteredQuestionAttempts: filteredQA,
      filteredSetAttempts: filteredSA,
      sharedDateRange: getSharedDateRange(
        filteredData.questionAttempts,
        filteredData.setAttempts,
        filteredData.mockAttempts,
        mode,
        timeFrameDays,
      ),
    };
  }, [filteredData, sectionId, progressMode]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref={backHref}
          backLabel={backLabel}
        />
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title={mocksOnly ? "Mock progress" : "Progress"}
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
          title={mocksOnly ? "Mock progress" : "Progress"}
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

  const sectionProjection =
    !mocksOnly && projectionQuery.data
      ? (projectionQuery.data.sections.find(
          (s) => s.sectionNumber === section.sectionNumber,
        ) ?? null)
      : null;
  const score =
    !mocksOnly && projectionQuery.data
      ? (sectionProjection?.currentEstimate ?? null)
      : null;
  return (
    <SectionProgressContent
      section={section}
      score={score}
      percentage={getSectionProgressPercentage(section, progressMode.mode)}
      totalPublicQuestions={section.totalPublicQuestions}
      totalPublicSets={
        filteredData?.totalPublicSetsBySection?.[section.sectionId]
      }
      totalPublicUntimedSets={
        filteredData?.totalPublicUntimedSetsBySection?.[section.sectionId]
      }
      totalPublicTimedSets={
        filteredData?.totalPublicTimedSetsBySection?.[section.sectionId]
      }
      filteredQuestionAttempts={filteredQuestionAttempts}
      filteredSetAttempts={filteredSetAttempts}
      categoryProgress={categoryProgress}
      progressMode={progressMode}
      sharedDateRange={sharedDateRange}
      scoreProjection={sectionProjection}
      mocksOnly={mocksOnly}
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
  categoryProgress,
  progressMode,
  sharedDateRange,
  scoreProjection,
  mocksOnly,
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
  categoryProgress: SectionCategoryProgress[];
  progressMode: ReturnType<typeof useProgressMode>;
  sharedDateRange?: ReturnType<typeof getSharedDateRange>;
  scoreProjection: SectionScoreProjection | null;
  mocksOnly: boolean;
  backHref: string;
  backLabel: string;
}) {
  const stats = useMemo(() => {
    const timeFiltered =
      progressMode.mode === "time_frame"
        ? filterByTimeFrame(
            filteredQuestionAttempts,
            progressMode.mode,
            progressMode.timeFrameDays,
          )
        : filteredQuestionAttempts;
    const unique = getBestAttemptPerQuestion(timeFiltered);
    const completed = sumProgressPointsFromAttempts(unique);
    const correct = sumCorrectScoreFromAttempts(unique);
    return {
      completed,
      correct,
      incorrect: completed - correct,
    };
  }, [filteredQuestionAttempts, progressMode.mode, progressMode.timeFrameDays]);

  const setsStats = useMemo(() => {
    const timeFiltered =
      progressMode.mode === "time_frame"
        ? filterByTimeFrame(
            filteredSetAttempts,
            progressMode.mode,
            progressMode.timeFrameDays,
          )
        : filteredSetAttempts;
    const nonStudentGenerated = timeFiltered.filter(
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
  }, [filteredSetAttempts, progressMode.mode, progressMode.timeFrameDays]);
  const percentile = formatUcatPercentile(score, "section");

  return (
    <div className="relative space-y-6 pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]">
      <UcatPageHeader
        title={
          mocksOnly
            ? `${section.sectionName} (mocks only)`
            : section.sectionName
        }
        description={
          mocksOnly
            ? `Mock exam progress for ${section.sectionName}`
            : `Progress for ${section.sectionName}`
        }
        backHref={backHref}
        backLabel={backLabel}
        breadcrumbOverrides={
          mocksOnly
            ? { 2: section.sectionName }
            : { 1: section.sectionName }
        }
      />

      <div className="flex flex-col gap-4">
        {!mocksOnly ? (
          <div className="flex justify-center">
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
        ) : null}

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
                    {progressMode.mode !== "time_frame" &&
                    totalPublicQuestions != null ? (
                      <>
                        {" / "}
                        <span className="tabular-nums">{totalPublicQuestions}</span>
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
                    {progressMode.mode !== "time_frame" &&
                    totalPublicSets != null ? (
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
                      {progressMode.mode !== "time_frame" &&
                      totalPublicUntimedSets != null ? (
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
                      {progressMode.mode !== "time_frame" &&
                      totalPublicTimedSets != null ? (
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

      {!mocksOnly ? <ScoreProjectionCard projection={scoreProjection} /> : null}

      <QuestionAttemptsCard
        attempts={filteredQuestionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
      <SetAttemptsCard
        attempts={filteredSetAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
        sectionNumber={section.sectionNumber}
      />

      <ProgressModeFloatingToolbar
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        attemptFilter={progressMode.attemptFilter}
        onAttemptFilterChange={progressMode.onAttemptFilterChange}
        showAttemptFilter={!mocksOnly}
      />
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
              Based on weighted mocks, sets, practice attempts, timing, recency,
              and recent effective practice pace.
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
