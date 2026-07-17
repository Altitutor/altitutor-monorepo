"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { format } from "date-fns";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { useSetAttemptDetail } from "../hooks/use-set-attempt-detail";
import { useAttemptReviewQuestionIndex } from "../hooks/use-attempt-review-question-index";
import { SetAnswersCard } from "./set-answers-card";
import { AttemptReviewSummaryGrid } from "./attempt-review-summary-grid";
import { computeCategoryBreakdown } from "../lib/compute-category-breakdown";
import { useMarkFirstResultReviewed } from "@/features/onboarding/hooks/use-activation-milestones";
import { useCompleteStudyPlanReview } from "@/features/study-plan/hooks/use-complete-study-plan-review";
import { useAttemptReviewTracking } from "../hooks/use-attempt-review-tracking";
import { AttemptReviewProgress } from "./attempt-review-progress";
import { buildAttemptOverallInsight } from "../lib/attempt-insights";

type SetAttemptDetailPageProps = {
  attemptId: string;
  backHref?: string;
  backLabel?: string;
};

export function SetAttemptDetailPage({
  attemptId,
  backHref = "/progress",
  backLabel = "Back to progress",
}: SetAttemptDetailPageProps) {
  const pathname = usePathname();
  const { data, isLoading, error } = useSetAttemptDetail(attemptId);
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
    attemptType: "set_attempt",
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

  if (isLoading) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set attempt"
          description="Could not load set attempt."
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
          title="Set attempt"
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
    examPacePercent:
      data.studentExamSpeed != null ? data.studentExamSpeed * 100 : null,
    recentPerformance: data.recentPerformance,
  });

  const attemptDate = format(new Date(data.attemptedAt), "d MMM yyyy");
  const lastSegmentLabel = `${data.questionSetName ?? "Set"} (${attemptDate})`;

  const breadcrumbOverrides: Record<number, string> = {};
  if (pathname.includes("/sections/")) {
    breadcrumbOverrides[2] = lastSegmentLabel;
  } else {
    breadcrumbOverrides[1] = lastSegmentLabel;
  }

  return (
    <motion.div
      className="min-w-0 max-w-full space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={data.questionSetName ?? "Set attempt"}
          description={`Attempt from ${new Date(data.attemptedAt).toLocaleDateString()}`}
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={
            Object.keys(breadcrumbOverrides).length > 0
              ? breadcrumbOverrides
              : undefined
          }
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
          scaledScore={data.scaledScore}
          percentile={data.percentile}
          categoryBreakdown={categoryBreakdown}
          chartData={data.questionAttempts}
          selectedQuestionIndex={selectedQuestionIndex}
          onBarClick={setSelectedQuestionIndex}
          timing={{
            timeTakenSeconds: data.timeTakenSeconds,
            setTimeLimitSeconds: data.setTimeLimitSeconds,
            examTimeLimitSeconds: data.examTimeLimitSeconds,
            studentSetSpeed: data.studentSetSpeed,
            studentExamSpeed: data.studentExamSpeed,
          }}
        />
      </motion.div>

      <motion.div id="attempt-review-questions" variants={itemVariants}>
        <SetAnswersCard
          questionAttempts={data.questionAttempts}
          exam={data.exam}
          initialQuestionIndex={selectedQuestionIndex}
          onQuestionIndexChange={setSelectedQuestionIndex}
          attemptReview
        />
      </motion.div>
    </motion.div>
  );
}
