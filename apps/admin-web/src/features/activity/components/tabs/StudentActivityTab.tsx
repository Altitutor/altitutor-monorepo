'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityTabLayout } from '../ActivityTabLayout';
import { useStudentActivity, useFormResponseDialog } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

interface StudentActivityTabProps {
  studentId: string;
  isOpen?: boolean;
}

export function StudentActivityTab({ studentId, isOpen = true }: StudentActivityTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useStudentActivity(studentId, isOpen);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'student',
    targetId: studentId,
    activityQueryKey: activityKeys.student(studentId),
  });

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.student(studentId) });
  }, [queryClient, studentId]);

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
