import { Skeleton } from '@altitutor/ui';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export function StudentDashboardPageSkeleton() {
  return (
    <div className="min-h-full" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <StudentPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </header>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          <div className={cn(studentCardCn('md:col-span-2'), 'space-y-3 p-4')}>
            <div className="flex items-end justify-between gap-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className={cn(studentCardCn(), 'space-y-3 p-4')}>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>

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
