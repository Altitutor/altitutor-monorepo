import { Suspense } from "react";
import { MocksProgressPage } from "@/features/progress";

export default function Page() {
  return (
    <Suspense fallback={<MocksProgressPageSkeleton />}>
      <MocksProgressPage />
    </Suspense>
  );
}

function MocksProgressPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="mx-auto h-32 w-full max-w-xs rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}
