import { Skeleton } from '@altitutor/ui';
import { StudentPageContainer } from '@/shared/components/layouts';

function SessionsBlockSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function StudentDashboardPageSkeleton() {
  return (
    <div className="min-h-full" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <StudentPageContainer className="space-y-10">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
          </div>
          <SessionsBlockSkeleton rows={2} />
        </section>

        <section className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <SessionsBlockSkeleton rows={2} />
        </section>

        <section className="space-y-4">
          <Skeleton className="h-8 w-28" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </section>
      </StudentPageContainer>
    </div>
  );
}
