'use client';

import { useMemo } from 'react';
import { ActivityItem } from './ActivityItem';
import { mapActivityEventsToDisplay } from '../mappers';
import type { ActivityEventsResponse } from '../types';
import { Skeleton } from '@altitutor/ui';
import { cn } from '@/shared/utils';

interface ActivityFeedProps {
  data?: ActivityEventsResponse;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

export function ActivityFeed({ data, isLoading, error, className }: ActivityFeedProps) {
  const activities = useMemo(() => {
    if (!data) return [];
    return mapActivityEventsToDisplay(data);
  }, [data]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>Failed to load activity feed</p>
        <p className="text-xs mt-1">{error.message}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          showConnector={index < activities.length - 1}
        />
      ))}
    </div>
  );
}

