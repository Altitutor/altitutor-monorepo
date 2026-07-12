import { Skeleton } from "@altitutor/ui";

type AppPageSkeletonProps = {
  variant?: "list" | "dashboard" | "detail";
};

export function AppPageSkeleton({
  variant = "dashboard",
}: AppPageSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-9 w-52 max-w-2/3" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {variant === "list" ? <ListSkeleton /> : null}
      {variant === "dashboard" ? <DashboardSkeleton /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="overflow-hidden rounded-xl border">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b p-4 last:border-b-0"
          >
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="hidden h-5 w-24 sm:block" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
