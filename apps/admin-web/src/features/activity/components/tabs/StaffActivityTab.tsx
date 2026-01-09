'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useStaffActivity } from '../../hooks';

interface StaffActivityTabProps {
  staffId: string;
  isOpen?: boolean;
}

export function StaffActivityTab({ staffId, isOpen = true }: StaffActivityTabProps) {
  const { data, isLoading, error } = useStaffActivity(staffId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

