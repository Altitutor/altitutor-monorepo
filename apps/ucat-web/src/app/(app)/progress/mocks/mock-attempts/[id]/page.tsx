import { Suspense } from "react";
import { MockAttemptDetailPage } from "@/features/progress/components/mock-attempt-detail-page";
import { AttemptReviewPageFallback } from "@/features/progress/components/attempt-review-page-fallback";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <AttemptReviewPageFallback
          backHref="/progress/mocks"
          backLabel="Back to mocks"
        />
      }
    >
      <MockAttemptDetailPage
        mockAttemptId={id}
        backHref="/progress/mocks"
        backLabel="Back to mocks"
      />
    </Suspense>
  );
}
