import { Skeleton } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';

function SessionsBlockSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36 shrink-0 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function TutorDashboardPageSkeleton() {
  return (
    <div className="min-h-full" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <TutorPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </header>

        <SessionsBlockSkeleton />

        <section className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </section>

        <section className="space-y-4">
          <Skeleton className="h-8 w-28" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </section>
      </TutorPageContainer>
    </div>
  );
}
