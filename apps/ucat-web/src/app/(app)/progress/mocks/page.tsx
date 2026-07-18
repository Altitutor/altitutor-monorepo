import { Suspense } from "react";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { MocksProgressPage } from "@/features/progress/components/mocks-progress-page";

export default function Page() {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <MocksProgressPage />
    </Suspense>
  );
}
