'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useTaskActivity } from '../../hooks';

interface TaskActivityTabProps {
  taskId: string;
  isOpen?: boolean;
}

export function TaskActivityTab({ taskId, isOpen = true }: TaskActivityTabProps) {
  const { data, isLoading, error } = useTaskActivity(taskId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

