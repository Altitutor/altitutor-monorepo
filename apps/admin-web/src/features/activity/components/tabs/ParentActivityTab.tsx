'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityTabLayout } from '../ActivityTabLayout';
import { useParentActivity, useFormResponseDialog } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

interface ParentActivityTabProps {
  parentId: string;
  isOpen?: boolean;
}

export function ParentActivityTab({ parentId, isOpen = true }: ParentActivityTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useParentActivity(parentId, isOpen);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'parent',
    targetId: parentId,
    activityQueryKey: activityKeys.parent(parentId),
  });

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.parent(parentId) });
  }, [queryClient, parentId]);

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
