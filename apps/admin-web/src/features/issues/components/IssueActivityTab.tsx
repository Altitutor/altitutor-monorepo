'use client';

import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { useIssueActivity } from '@/features/activity/hooks';

interface IssueActivityTabProps {
  issueId: string;
  studentIds?: string[];
  staffIds?: string[];
  classIds?: string[];
  sessionIds?: string[];
  invoiceIds?: string[];
  isOpen?: boolean;
}

export function IssueActivityTab({ 
  issueId, 
  studentIds, 
  staffIds, 
  classIds, 
  sessionIds, 
  invoiceIds, 
  isOpen = true 
}: IssueActivityTabProps) {
  const { data, isLoading, error } = useIssueActivity({
    issueId,
    studentIds,
    staffIds,
    classIds,
    sessionIds,
    invoiceIds,
    enabled: isOpen
  });

  return (
    <div className="h-full">
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}
