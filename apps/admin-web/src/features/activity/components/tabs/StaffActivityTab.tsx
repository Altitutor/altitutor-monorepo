'use client';

import { useState, useCallback } from 'react';
import { ActivityFeed } from '../ActivityFeed';
import { ActivityNoteComposer } from '../ActivityNoteComposer';
import { useStaffActivity, useFormResponseDialog } from '../../hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';
import type { JSONContent } from '@tiptap/core';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface StaffActivityTabProps {
  staffId: string;
  isOpen?: boolean;
}

export function StaffActivityTab({ staffId, isOpen = true }: StaffActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useStaffActivity(staffId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.staff(staffId) });
  }, [queryClient, staffId]);

  const handleSubmit = useCallback(async () => {
    if (!currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'staff',
        targetId: staffId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget('staff', staffId) });
      invalidateActivity();
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, staffId, createNoteMutation, queryClient, invalidateActivity]);

  return (
    <div className="h-full space-y-6">
      <ActivityNoteComposer
        content={newNoteContent}
        onChange={setNewNoteContent}
        onSubmit={handleSubmit}
        isSubmitting={createNoteMutation.isPending}
        canPost={Boolean(currentStaff)}
      />

      <ActivityFeed
        data={data}
        isLoading={isLoading}
        error={error}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        onOpenFormResponse={openFormResponse}
      />
      <FormResponseDialog
        response={selectedResponse}
        onClose={closeFormResponse}
        onUpdated={invalidateActivity}
        onDeleted={invalidateActivity}
      />
    </div>
  );
}
