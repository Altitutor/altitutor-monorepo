'use client';

import { ActivityTabLayout } from '@/features/activity/components/ActivityTabLayout';
import { useAdminShiftActivity } from '@/features/activity/hooks';
import { useEntityActivityNoteComposer } from '@/features/activity/hooks/useEntityActivityNoteComposer';
import { activityKeys } from '@/features/activity/hooks/useActivityEvents';

interface AdminShiftActivityTabProps {
  adminShiftId: string;
  isOpen?: boolean;
}

export function AdminShiftActivityTab({ adminShiftId, isOpen = true }: AdminShiftActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useAdminShiftActivity(adminShiftId, isOpen);
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'admin_shift',
    targetId: adminShiftId,
    activityQueryKey: activityKeys.adminShift(adminShiftId),
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
