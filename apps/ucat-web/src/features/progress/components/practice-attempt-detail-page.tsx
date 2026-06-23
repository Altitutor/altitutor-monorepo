"use client";

import { useMemo } from "react";
import { UcatPageHeader } from "@/features/layout";
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

type PracticeAttemptDetailPageProps = {
  attemptId: string;
  backHref?: string;
  backLabel?: string;
};

export function PracticeAttemptDetailPage({
  attemptId,
  backHref = "/progress",
  backLabel = "Back to progress",
}: PracticeAttemptDetailPageProps) {
  const { data, isLoading, error } = usePracticeAttemptDetail(attemptId);
  const questionCount = data?.questionAttempts.length ?? 0;
  const { selectedQuestionIndex, setSelectedQuestionIndex } =
    useAttemptReviewQuestionIndex(questionCount);

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(data?.questionAttempts ?? []),
    [data?.questionAttempts],
  );

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
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref={backHref}
          backLabel={backLabel}
        />
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    );
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

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <UcatPageHeader
        title={data.sectionName ?? "Practice session"}
        description={`Attempt from ${new Date(data.attemptedAt).toLocaleDateString()}`}
        backHref={backHref}
        backLabel={backLabel}
      />

      <AttemptReviewSummaryGrid
        points={points}
        total={total}
        categoryBreakdown={categoryBreakdown}
        chartData={data.questionAttempts}
        selectedQuestionIndex={selectedQuestionIndex}
        onBarClick={setSelectedQuestionIndex}
      />

      <SetAnswersCard
        questionAttempts={data.questionAttempts}
        exam={examFromStems}
        initialQuestionIndex={selectedQuestionIndex}
        onQuestionIndexChange={setSelectedQuestionIndex}
        attemptReview
      />
    </div>
  );
}
