"use client";

import { WorkItemActivity } from "../WorkItemActivity";
import type { ActivityNote } from "../../types";
import { useTaskActivity } from "../../hooks";

interface TaskActivityTabProps {
  taskId: string;
  isOpen?: boolean;
  notes?: ActivityNote[];
}

export function TaskActivityTab({
  taskId,
  isOpen = true,
  notes,
}: TaskActivityTabProps) {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTaskActivity(taskId, isOpen);

  return (
    <WorkItemActivity
      kind="task"
      entityId={taskId}
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
