"use client";

import { WorkItemActivity } from "@/features/activity/components/WorkItemActivity";
import type { ActivityNote } from "@/features/activity/types";
import { useIssueActivity } from "@/features/activity/hooks";

interface IssueActivityTabProps {
  issueId: string;
  studentIds?: string[];
  staffIds?: string[];
  classIds?: string[];
  sessionIds?: string[];
  invoiceIds?: string[];
  isOpen?: boolean;
  notes?: ActivityNote[];
}

export function IssueActivityTab({
  issueId,
  studentIds,
  staffIds,
  classIds,
  sessionIds,
  invoiceIds,
  isOpen = true,
  notes,
}: IssueActivityTabProps) {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useIssueActivity({
    issueId,
    studentIds,
    staffIds,
    classIds,
    sessionIds,
    invoiceIds,
    enabled: isOpen,
  });

  return (
    <WorkItemActivity
      kind="issue"
      entityId={issueId}
      notes={notes}
      data={data}
      isLoading={isLoading}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
    />
  );
}
