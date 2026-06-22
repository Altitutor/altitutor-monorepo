import { Suspense } from "react";
import { SetAttemptDetailPage } from "@/features/progress";
import { AttemptReviewPageFallback } from "@/features/progress/components/attempt-review-page-fallback";

type PageProps = {
  params: { id: string; setAttemptId: string };
};

export default function Page({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <AttemptReviewPageFallback
          backHref={`/progress/mock-attempts/${params.id}`}
          backLabel="Back to mock attempt"
        />
      }
    >
      <SetAttemptDetailPage
        attemptId={params.setAttemptId}
        mockAttemptId={params.id}
        backHref={`/progress/mock-attempts/${params.id}`}
        backLabel="Back to mock attempt"
      />
    </Suspense>
  );
}
