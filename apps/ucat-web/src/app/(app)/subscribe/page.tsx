import { Suspense } from "react";
import { SubscribePage } from "@/features/subscription";

export default function Page() {
  return (
    <Suspense fallback={<SubscribePageSkeleton />}>
      <SubscribePage />
    </Suspense>
  );
}

function SubscribePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-56 rounded bg-muted" />
        <div className="h-4 max-w-xl rounded bg-muted" />
      </div>
      <div className="h-40 rounded-lg border border-border bg-muted/50" />
    </div>
  );
}
