import { Suspense } from "react";
import { PracticeAttemptDetailPage } from "@/features/progress";
import { AttemptReviewPageFallback } from "@/features/progress/components/attempt-review-page-fallback";

type PageProps = {
  params: { id: string };
};

export default function Page({ params }: PageProps) {
  return (
    <Suspense fallback={<AttemptReviewPageFallback />}>
      <PracticeAttemptDetailPage attemptId={params.id} />
    </Suspense>
  );
}
