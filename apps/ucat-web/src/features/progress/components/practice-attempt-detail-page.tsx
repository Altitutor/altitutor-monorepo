"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { usePracticeAttemptDetail } from "../hooks/use-practice-attempt-detail";
import { useAttemptReviewQuestionIndex } from "../hooks/use-attempt-review-question-index";
import { SetAnswersCard } from "./set-answers-card";
import { AttemptReviewSummaryGrid } from "./attempt-review-summary-grid";
import { computeCategoryBreakdown } from "../lib/compute-category-breakdown";
import {
  mapQuestionStemsToItems,
  type QuestionEngineExam,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import { useMarkFirstResultReviewed } from "@/features/onboarding/hooks/use-activation-milestones";
import { useCompleteStudyPlanReview } from "@/features/study-plan/hooks/use-complete-study-plan-review";
import { useAttemptReviewTracking } from "../hooks/use-attempt-review-tracking";
import { AttemptReviewProgress } from "./attempt-review-progress";
import { buildAttemptOverallInsight } from "../lib/attempt-insights";

type PracticeAttemptDetailPageProps = {
  attemptId: string;
  backHref?: string;
  backLabel?: string;
};

function computePracticeTiming(input: {
  attemptedAt: string;
  completedAt: string | null;
  questionAttempts: Array<{ timeSpentSeconds: number | null }>;
}): {
  sessionTimeSeconds: number | null;
  averageTimePerQuestionSeconds: number | null;
} {
  const questionTimes = input.questionAttempts
    .map((q) => q.timeSpentSeconds)
    .filter((t): t is number => t != null && t >= 0);
  const summedQuestionTime =
    questionTimes.length > 0
      ? questionTimes.reduce((sum, t) => sum + t, 0)
      : null;

  let sessionTimeSeconds: number | null = null;
  if (input.completedAt && input.attemptedAt) {
    const elapsedMs =
      new Date(input.completedAt).getTime() -
      new Date(input.attemptedAt).getTime();
    if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
      sessionTimeSeconds = Math.round(elapsedMs / 1000);
    }
  }
  if (sessionTimeSeconds == null) {
    sessionTimeSeconds = summedQuestionTime;
  }

  const averageTimePerQuestionSeconds =
    summedQuestionTime != null && questionTimes.length > 0
      ? summedQuestionTime / questionTimes.length
      : sessionTimeSeconds != null && input.questionAttempts.length > 0
        ? sessionTimeSeconds / input.questionAttempts.length
        : null;

  return { sessionTimeSeconds, averageTimePerQuestionSeconds };
}

export function PracticeAttemptDetailPage({
  attemptId,
  backHref = "/progress",
  backLabel = "Back to progress",
}: PracticeAttemptDetailPageProps) {
  const { data, isLoading, error } = usePracticeAttemptDetail(attemptId);
  useMarkFirstResultReviewed(Boolean(data));
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const questionCount = data?.questionAttempts.length ?? 0;
  const { selectedQuestionIndex, setSelectedQuestionIndex } =
    useAttemptReviewQuestionIndex(questionCount);
  const requiredQuestionIds = useMemo(
    () =>
      (data?.questionAttempts ?? [])
        .filter((question) => question.result !== "correct")
        .map((question) => question.questionId),
    [data?.questionAttempts],
  );
  const reviewTracking = useAttemptReviewTracking({
    attemptType: "practice_session",
    attemptId,
    requiredQuestionIds,
    selectedQuestionId:
      data?.questionAttempts[selectedQuestionIndex]?.questionId ?? null,
    ready: Boolean(data),
  });
  useCompleteStudyPlanReview(Boolean(reviewTracking.review?.completedAt));
  const reviewNextIncorrect = reviewTracking.nextUnviewedQuestionId
    ? () => {
        const index = data?.questionAttempts.findIndex(
          (question) =>
            question.questionId === reviewTracking.nextUnviewedQuestionId,
        );
        if (index == null || index < 0) return;
        setSelectedQuestionIndex(index);
        document
          .getElementById("attempt-review-questions")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    : null;

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(data?.questionAttempts ?? []),
    [data?.questionAttempts],
  );

  const practiceTiming = useMemo(() => {
    if (!data) return null;
    return computePracticeTiming({
      attemptedAt: data.attemptedAt,
      completedAt: data.completedAt,
      questionAttempts: data.questionAttempts,
    });
  }, [data]);

  const examFromStems = useMemo((): QuestionEngineExam | null => {
    const stems = data?.stemsSnapshot as
      | QuestionStemWithQuestions[]
      | undefined;
    if (!stems || !Array.isArray(stems) || stems.length === 0) return null;
    return {
      sourceType: "questionStem",
      sourceId: "practice",
      title: data?.sectionName ?? "Practice",
      questions: mapQuestionStemsToItems(stems),
      instructionsScreens: [],
    };
  }, [data?.stemsSnapshot, data?.sectionName]);

  if (isLoading) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Practice session"
          description="Could not load practice session."
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
          title="Practice session"
          description="No data available."
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    );
  }

  const total = data.totalPoints ?? 0;
  const points = data.scorePoints ?? 0;
  const overallInsight = buildAttemptOverallInsight({
    accuracyPercent: total > 0 ? (points / total) * 100 : null,
    averageTimePerQuestionSeconds:
      practiceTiming?.averageTimePerQuestionSeconds ?? null,
    recentPerformance: data.recentPerformance,
  });

  return (
    <motion.div
      className="min-w-0 max-w-full space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={data.sectionName ?? "Practice session"}
          description={`Attempt from ${new Date(data.attemptedAt).toLocaleDateString()}`}
          backHref={backHref}
          backLabel={backLabel}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <AttemptReviewProgress
          review={reviewTracking.review}
          pending={reviewTracking.isPending}
          error={reviewTracking.error}
          onFinish={reviewTracking.completeManually}
          onReviewNext={reviewNextIncorrect}
          insight={overallInsight}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <AttemptReviewSummaryGrid
          points={points}
          total={total}
          categoryBreakdown={categoryBreakdown}
          chartData={data.questionAttempts}
          selectedQuestionIndex={selectedQuestionIndex}
          onBarClick={setSelectedQuestionIndex}
          practiceTiming={practiceTiming ?? undefined}
        />
      </motion.div>

      <motion.div id="attempt-review-questions" variants={itemVariants}>
        <SetAnswersCard
          questionAttempts={data.questionAttempts}
          exam={examFromStems}
          initialQuestionIndex={selectedQuestionIndex}
          onQuestionIndexChange={setSelectedQuestionIndex}
          attemptReview
        />
      </motion.div>
    </motion.div>
  );
}
