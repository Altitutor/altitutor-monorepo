"use client";

import { UcatPageHeader } from "@/features/layout";
import { useMockAttemptDetail } from "../hooks/use-mock-attempt-detail";
import { useAttemptReviewQuestionIndex } from "../hooks/use-attempt-review-question-index";
import { MockAttemptSummaryGrid } from "./mock-attempt-summary-grid";
import { SetAnswersCard } from "./set-answers-card";

type MockAttemptDetailPageProps = {
  mockAttemptId: string;
};

export function MockAttemptDetailPage({
  mockAttemptId,
}: MockAttemptDetailPageProps) {
  const { data, isLoading, error } = useMockAttemptDetail(mockAttemptId);
  const questionCount = data?.questionAttempts.length ?? 0;
  const { selectedQuestionIndex, setSelectedQuestionIndex } =
    useAttemptReviewQuestionIndex(questionCount);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref="/progress"
          backLabel="Back to progress"
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
          title="Mock attempt"
          description="Could not load mock attempt."
          backHref="/progress"
          backLabel="Back to progress"
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
          backHref="/progress"
          backLabel="Back to progress"
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
  }));

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <UcatPageHeader
        title={data.mockName ?? "Mock attempt"}
        description={`Attempted ${attemptedDate}`}
        backHref="/progress"
        backLabel="Back to progress"
        breadcrumbOverrides={{ 2: data.mockName ?? "Mock" }}
      />

      <MockAttemptSummaryGrid
        scaledScore={data.scaledScore}
        scaledScoreMax={data.scaledScoreMax}
        sets={data.sets}
        mockAttemptId={mockAttemptId}
        chartData={chartData}
        setBoundaryIndices={data.setBoundaryIndices}
        selectedQuestionIndex={selectedQuestionIndex}
        onBarClick={setSelectedQuestionIndex}
      />

      <SetAnswersCard
        mockId={data.ucatMockId}
        questionAttempts={data.questionAttempts}
        initialQuestionIndex={selectedQuestionIndex}
        onQuestionIndexChange={setSelectedQuestionIndex}
        attemptReview
      />
    </div>
  );
}
