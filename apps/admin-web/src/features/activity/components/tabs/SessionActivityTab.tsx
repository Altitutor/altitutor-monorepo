'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityTabLayout } from '../ActivityTabLayout';
import { useSessionActivity, useFormResponseDialog } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

interface SessionActivityTabProps {
  sessionId: string;
  isOpen?: boolean;
}


export function SessionActivityTab({ sessionId, isOpen = true }: SessionActivityTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSessionActivity(sessionId, isOpen);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'sessions',
    targetId: sessionId,
    activityQueryKey: activityKeys.session(sessionId),
  });

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) });
  }, [queryClient, sessionId]);

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
