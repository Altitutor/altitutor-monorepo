'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityTabLayout } from '../ActivityTabLayout';
import { useStaffActivity, useFormResponseDialog } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

interface StaffActivityTabProps {
  staffId: string;
  isOpen?: boolean;
}

export function StaffActivityTab({ staffId, isOpen = true }: StaffActivityTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useStaffActivity(staffId, isOpen);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'staff',
    targetId: staffId,
    activityQueryKey: activityKeys.staff(staffId),
  });

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.staff(staffId) });
  }, [queryClient, staffId]);

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
      onOpenFormResponse={openFormResponse}
      footer={(
        <FormResponseDialog
          response={selectedResponse}
          onClose={closeFormResponse}
          onUpdated={invalidateActivity}
          onDeleted={invalidateActivity}
        />
      )}
    />
  );
}
