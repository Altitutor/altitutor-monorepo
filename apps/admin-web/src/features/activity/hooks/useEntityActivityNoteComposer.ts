'use client';

import { useState, useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface UseEntityActivityNoteComposerOptions {
  targetType: string;
  targetId: string;
  activityQueryKey: QueryKey;
}

export function useEntityActivityNoteComposer({
  targetType,
  targetId,
  activityQueryKey,
}: UseEntityActivityNoteComposerOptions) {
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);

  const handleSubmit = useCallback(async () => {
    if (!currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType,
        targetId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget(targetType, targetId) });
      queryClient.invalidateQueries({ queryKey: activityQueryKey });
    } catch {
      // Error handled silently - user can retry
    }
  }, [
    activityQueryKey,
    createNoteMutation,
    currentStaff?.id,
    newNoteContent,
    queryClient,
    targetId,
    targetType,
  ]);

  return {
    content: newNoteContent,
    onChange: setNewNoteContent,
    onSubmit: handleSubmit,
    isSubmitting: createNoteMutation.isPending,
    canPost: Boolean(currentStaff),
  };
}
