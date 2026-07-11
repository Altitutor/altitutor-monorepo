"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useSetAttemptDetail } from "../hooks/use-set-attempt-detail";
import { useAttemptReviewQuestionIndex } from "../hooks/use-attempt-review-question-index";
import { SetAnswersCard } from "./set-answers-card";
import { AttemptReviewSummaryGrid } from "./attempt-review-summary-grid";
import { computeCategoryBreakdown } from "../lib/compute-category-breakdown";

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
  const questionCount = data?.questionAttempts.length ?? 0;
  const { selectedQuestionIndex, setSelectedQuestionIndex } =
    useAttemptReviewQuestionIndex(questionCount);

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

  const attemptDate = format(new Date(data.attemptedAt), "d MMM yyyy");
  const lastSegmentLabel = `${data.questionSetName ?? "Set"} (${attemptDate})`;

  const breadcrumbOverrides: Record<number, string> = {};
  if (pathname.includes("/sections/")) {
    breadcrumbOverrides[2] = lastSegmentLabel;
  } else {
    breadcrumbOverrides[1] = lastSegmentLabel;
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
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

      <AttemptReviewSummaryGrid
        points={points}
        total={total}
        scaledScore={data.scaledScore}
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

      <SetAnswersCard
        questionSetId={data.questionSetId}
        questionAttempts={data.questionAttempts}
        initialQuestionIndex={selectedQuestionIndex}
        onQuestionIndexChange={setSelectedQuestionIndex}
        attemptReview
      />
    </div>
  );
}
