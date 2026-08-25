'use client';

import { ActivityTabLayout } from '../ActivityTabLayout';
import { useTaskActivity } from '../../hooks';

interface TaskActivityTabProps {
  taskId: string;
  isOpen?: boolean;
}

export function TaskActivityTab({ taskId, isOpen = true }: TaskActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useTaskActivity(taskId, isOpen);

  return (
    <ActivityTabLayout
      data={data}
      isLoading={isLoading}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
    />
  );
}
