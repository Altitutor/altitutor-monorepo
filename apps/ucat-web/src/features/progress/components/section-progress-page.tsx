"use client";

import { useMemo } from "react";
import { UcatPageHeader } from "@/features/layout";
import { useProgress } from "../hooks/use-progress";
import { useProgressMode } from "../hooks/use-progress-mode";
import { ProgressModeFloatingToolbar } from "./progress-mode-floating-toolbar";
import { SetAttemptsCard } from "./set-attempts-card";
import { QuestionAttemptsCard } from "./question-attempts-card";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  filterByTimeFrame,
  computeSingleSectionFromFiltered,
  computeCategoryProgressFromFiltered,
  getBestAttemptPerQuestion,
  applyAttemptFilterToProgress,
  getSharedDateRange,
} from "../lib/progress-data-utils";
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";
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

  const score =
    progressMode.mode === "weighted"
      ? section.weightedAverageScaledScore
      : section.averageScaledScore;
  const percentage =
    progressMode.mode === "weighted" &&
    section.weightedAveragePercentage != null
      ? Math.round(section.weightedAveragePercentage)
      : section.percentage;

  return (
    <SectionProgressContent
      section={section}
      score={score}
      percentage={percentage}
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
    let completed = 0;
    let correct = 0;
    for (const a of unique) {
      const maxPerQuestion = a.questionType === "syllogism" ? 2 : 1;
      completed += maxPerQuestion;
      correct += a.score ?? 0;
    }
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
            ? { 3: section.sectionName }
            : { 2: section.sectionName }
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <Card className={cn(UCAT_CARD_CHROME, "w-full max-w-xs")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-center">
                Scaled score
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
                      const pct = (c: SectionCategoryProgress) =>
                        progressMode.mode === "weighted" &&
                        c.weightedAveragePercentage != null
                          ? c.weightedAveragePercentage
                          : c.percentage;
                      const best =
                        catsWithAttempts.length > 0
                          ? catsWithAttempts.reduce((a, b) =>
                              pct(a) >= pct(b) ? a : b,
                            )
                          : null;
                      const worst =
                        catsWithAttempts.length > 1
                          ? catsWithAttempts.reduce((a, b) =>
                              pct(a) <= pct(b) ? a : b,
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
