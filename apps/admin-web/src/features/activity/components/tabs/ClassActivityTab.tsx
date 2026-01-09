'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useClassActivity } from '../../hooks';

interface ClassActivityTabProps {
  classId: string;
  isOpen?: boolean;
}

export function ClassActivityTab({ classId, isOpen = true }: ClassActivityTabProps) {
  const { data, isLoading, error } = useClassActivity(classId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

