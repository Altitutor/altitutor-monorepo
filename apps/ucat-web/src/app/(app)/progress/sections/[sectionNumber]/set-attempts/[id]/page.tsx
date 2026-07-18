import { Suspense } from "react";
import { SetAttemptDetailPage } from "@/features/progress/components/set-attempt-detail-page";
import { AttemptReviewPageFallback } from "@/features/progress/components/attempt-review-page-fallback";

type PageProps = {
  params: Promise<{ sectionNumber: string; id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sectionNumber, id } = await params;
  return (
    <Suspense
      fallback={
        <AttemptReviewPageFallback
          backHref={`/progress/sections/${sectionNumber}`}
          backLabel="Back to section"
        />
      }
    >
      <SetAttemptDetailPage
        attemptId={id}
        backHref={`/progress/sections/${sectionNumber}`}
        backLabel="Back to section"
      />
    </Suspense>
  );
}
