'use client';

import { ActivityFeed } from '../ActivityFeed';
import { useSessionActivity } from '../../hooks';

interface SessionActivityTabProps {
  sessionId: string;
  isOpen?: boolean;
}

export function SessionActivityTab({ sessionId, isOpen = true }: SessionActivityTabProps) {
  const { data, isLoading, error } = useSessionActivity(sessionId, isOpen);

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

