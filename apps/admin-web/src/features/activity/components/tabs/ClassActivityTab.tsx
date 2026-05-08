'use client';

import { useState, useCallback } from 'react';
import { ActivityFeed } from '../ActivityFeed';
import { ActivityNoteComposer } from '../ActivityNoteComposer';
import { useClassActivity } from '../../hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';
import type { JSONContent } from '@tiptap/core';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface ClassActivityTabProps {
  classId: string;
  isOpen?: boolean;
}

export function ClassActivityTab({ classId, isOpen = true }: ClassActivityTabProps) {
  const { data, isLoading, error } = useClassActivity(classId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);

  const handleSubmit = useCallback(async () => {
    if (!currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'class',
        targetId: classId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget('class', classId) });
      queryClient.invalidateQueries({ queryKey: activityKeys.class(classId) });
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, classId, createNoteMutation, queryClient]);

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
