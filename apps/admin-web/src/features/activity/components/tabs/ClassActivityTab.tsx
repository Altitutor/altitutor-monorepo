'use client';

import { ActivityTabLayout } from '../ActivityTabLayout';
import { useClassActivity } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';

interface ClassActivityTabProps {
  classId: string;
  isOpen?: boolean;
}

export function ClassActivityTab({ classId, isOpen = true }: ClassActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useClassActivity(classId, isOpen);
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'class',
    targetId: classId,
    activityQueryKey: activityKeys.class(classId),
  });

  return (
    <ActivityTabLayout
      showComposer
      composerProps={composerProps}
      data={data}
      isLoading={isLoading}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
    />
  );
}
