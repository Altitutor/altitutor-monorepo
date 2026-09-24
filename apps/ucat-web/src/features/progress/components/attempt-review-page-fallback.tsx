import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";

type AttemptReviewPageFallbackProps = {
  backHref?: string;
  backLabel?: string;
};

export function AttemptReviewPageFallback({
  backHref: _backHref = "/progress",
  backLabel: _backLabel = "Back to progress",
}: AttemptReviewPageFallbackProps) {
  return <AppPageSkeleton variant="detail" />;
}
