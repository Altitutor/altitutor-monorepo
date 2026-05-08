'use client';

import { useState, useCallback } from 'react';
import { ActivityFeed } from '../ActivityFeed';
import { ActivityNoteComposer } from '../ActivityNoteComposer';
import { useStaffActivity } from '../../hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';
import type { JSONContent } from '@tiptap/core';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface StaffActivityTabProps {
  staffId: string;
  isOpen?: boolean;
}

export function StaffActivityTab({ staffId, isOpen = true }: StaffActivityTabProps) {
  const { data, isLoading, error } = useStaffActivity(staffId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);

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
      queryClient.invalidateQueries({ queryKey: activityKeys.staff(staffId) });
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, staffId, createNoteMutation, queryClient]);

  return (
    <div className="h-full space-y-6">
      <ActivityNoteComposer
        content={newNoteContent}
        onChange={setNewNoteContent}
        onSubmit={handleSubmit}
        isSubmitting={createNoteMutation.isPending}
        canPost={Boolean(currentStaff)}
      />

      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}
