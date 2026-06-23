"use client";

import { UcatPageHeader } from "@/features/layout";

type AttemptReviewPageFallbackProps = {
  backHref?: string;
  backLabel?: string;
};

export function AttemptReviewPageFallback({
  backHref = "/progress",
  backLabel = "Back to progress",
}: AttemptReviewPageFallbackProps) {
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
