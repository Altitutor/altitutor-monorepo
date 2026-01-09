'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useParentActivity } from '../../hooks';

interface ParentActivityTabProps {
  parentId: string;
  isOpen?: boolean;
}

export function ParentActivityTab({ parentId, isOpen = true }: ParentActivityTabProps) {
  const { data, isLoading, error } = useParentActivity(parentId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

