import { Skeleton } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';

function SessionsBlockSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-2 pt-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-none" />
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

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <SessionsBlockSkeleton />
          </div>
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </div>

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
