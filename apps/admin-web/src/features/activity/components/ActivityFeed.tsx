'use client';

import { useMemo } from 'react';
import { ActivityItem } from './ActivityItem';
import { mapActivityEventsToDisplay } from '../mappers';
import type { ActivityEventsResponse } from '../types';
import { Button, Skeleton } from '@altitutor/ui';
import { cn } from '@/shared/utils';

interface ActivityFeedProps {
  data?: ActivityEventsResponse;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onOpenFormResponse?: (responseId: string) => void;
}

export function ActivityFeed({
  data,
  isLoading,
  error,
  className,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onOpenFormResponse,
}: ActivityFeedProps) {
  const activities = useMemo(() => {
    if (!data) return [];
    return mapActivityEventsToDisplay(data);
  }, [data]);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        <p>Failed to load activity feed</p>
        <p className="mt-1 text-xs">{error.message}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onOpenFormResponse={onOpenFormResponse}
        />
      ))}

      {hasNextPage && onLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
