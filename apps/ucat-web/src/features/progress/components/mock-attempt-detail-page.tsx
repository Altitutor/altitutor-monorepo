"use client";

import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { useMockAttemptDetail } from "../hooks/use-mock-attempt-detail";
import { useAttemptReviewQuestionIndex } from "../hooks/use-attempt-review-question-index";
import { MockAttemptQuestionAttemptsCard } from "./mock-attempt-question-attempts-card";
import { MockAttemptScoreTimingRow } from "./mock-attempt-score-timing-row";
import { MockAttemptSetCards } from "./mock-attempt-set-cards";
import { SetAnswersCard } from "./set-answers-card";

type MockAttemptDetailPageProps = {
  mockAttemptId: string;
  backHref?: string;
  backLabel?: string;
};

export function MockAttemptDetailPage({
  mockAttemptId,
  backHref = "/progress/mocks",
  backLabel = "Back to mocks",
}: MockAttemptDetailPageProps) {
  const { data, isLoading, error } = useMockAttemptDetail(mockAttemptId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const questionCount = data?.questionAttempts.length ?? 0;
  const { selectedQuestionIndex, setSelectedQuestionIndex } =
    useAttemptReviewQuestionIndex(questionCount);

  if (isLoading) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock attempt"
          description="Could not load mock attempt."
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
          title="Mock attempt"
          description="No data available."
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    );
  }

  const attemptedDate = new Date(data.attemptedAt).toLocaleDateString();

  const chartData = data.questionAttempts.map((q) => ({
    questionNumber: q.questionNumber,
    stemIndex: q.stemIndex,
    timeSpentSeconds: q.timeSpentSeconds,
    result: q.result,
    score: q.score,
    questionType: q.questionType,
  }));

  const handleSelectSet = (setIndex: number) => {
    const firstQuestionIndex = data.questionAttempts.findIndex(
      (q) => q.setIndex === setIndex,
    );
    if (firstQuestionIndex < 0) return;
    setSelectedQuestionIndex(firstQuestionIndex);
    document
      .getElementById("attempt-review-questions")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.div
      className="min-w-0 max-w-full space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={data.mockName ?? "Mock attempt"}
          description={`Attempted ${attemptedDate}`}
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={{ 2: data.mockName ?? "Mock" }}
        />
      </motion.div>

      <motion.div className="flex flex-col gap-4" variants={itemVariants}>
        <MockAttemptScoreTimingRow
          scaledScore={data.scaledScore}
          timing={{
            timeTakenSeconds: data.timeTakenSeconds,
            setTimeLimitSeconds: data.mockTimeLimitSeconds,
            examTimeLimitSeconds: data.examTimeLimitSeconds,
            studentSetSpeed: data.studentMockSpeed,
            studentExamSpeed: data.studentExamSpeed,
          }}
        />

        <MockAttemptSetCards
          sets={data.sets}
          questionAttempts={data.questionAttempts}
          onSelectSet={handleSelectSet}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <MockAttemptQuestionAttemptsCard
          chartData={chartData}
          setBoundaryIndices={data.setBoundaryIndices}
          sets={data.sets.map((s) => ({
            questionSetName: s.questionSetName,
          }))}
          selectedQuestionIndex={selectedQuestionIndex}
          onBarClick={setSelectedQuestionIndex}
        />
      </motion.div>

      <motion.div id="attempt-review-questions" variants={itemVariants}>
        <SetAnswersCard
          mockId={data.ucatMockId}
          questionAttempts={data.questionAttempts}
          initialQuestionIndex={selectedQuestionIndex}
          onQuestionIndexChange={setSelectedQuestionIndex}
          attemptReview
        />
      </motion.div>
    </motion.div>
  );
}
