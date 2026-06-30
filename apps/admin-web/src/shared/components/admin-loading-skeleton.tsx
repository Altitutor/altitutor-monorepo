'use client';

import { Skeleton, SkeletonCard, SkeletonPageHeader, SkeletonTable } from '@altitutor/ui';
import { cn } from '@/shared/utils';

type AdminLoadingSkeletonProps = {
  variant?: 'page' | 'card' | 'table' | 'list';
  rows?: number;
  className?: string;
};

export function AdminLoadingSkeleton({
  variant = 'page',
  rows = 6,
  className,
}: AdminLoadingSkeletonProps) {
  if (variant === 'table') {
    return (
      <div className={cn('space-y-4 p-6', className)}>
        <SkeletonPageHeader />
        <SkeletonTable rows={rows} columns={5} />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3 p-4', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('space-y-4 p-4', className)}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 p-6', className)}>
      <SkeletonPageHeader showBack />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
      <SkeletonTable rows={rows} columns={5} />
    </div>
  );
}
