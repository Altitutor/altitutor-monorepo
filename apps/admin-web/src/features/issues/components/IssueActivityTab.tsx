'use client';

import { ActivityTabLayout } from '@/features/activity/components/ActivityTabLayout';
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
  isOpen = true,
}: IssueActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useIssueActivity({
    issueId,
    studentIds,
    staffIds,
    classIds,
    sessionIds,
    invoiceIds,
    enabled: isOpen,
  });

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
