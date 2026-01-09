'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useStudentActivity } from '../../hooks';

interface StudentActivityTabProps {
  studentId: string;
  isOpen?: boolean;
}

export function StudentActivityTab({ studentId, isOpen = true }: StudentActivityTabProps) {
  const { data, isLoading, error } = useStudentActivity(studentId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

