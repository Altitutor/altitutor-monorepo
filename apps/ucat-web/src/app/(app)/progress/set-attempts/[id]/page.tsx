import { Suspense } from "react";
import { SetAttemptDetailPage } from "@/features/progress/components/set-attempt-detail-page";
import { AttemptReviewPageFallback } from "@/features/progress/components/attempt-review-page-fallback";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <Suspense fallback={<AttemptReviewPageFallback />}>
      <SetAttemptDetailPage attemptId={params.id} />
    </Suspense>
  );
}
