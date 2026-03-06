'use client';

import { useState, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { NotesEditorWithMentions } from '@/shared/components/NotesEditorWithMentions';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import { useAdminShiftActivity } from '@/features/activity/hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '@/features/activity/hooks/useActivityEvents';
import type { JSONContent } from '@tiptap/core';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface AdminShiftActivityTabProps {
  adminShiftId: string;
  isOpen?: boolean;
}

export function AdminShiftActivityTab({ adminShiftId, isOpen = true }: AdminShiftActivityTabProps) {
  const { data, isLoading, error } = useAdminShiftActivity(adminShiftId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);

  const handleSubmit = useCallback(async () => {
    if (isTiptapContentEmpty(newNoteContent) || !currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'admin_shift',
        targetId: adminShiftId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget('admin_shift', adminShiftId) });
      queryClient.invalidateQueries({ queryKey: activityKeys.adminShift(adminShiftId) });
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, adminShiftId, createNoteMutation, queryClient]);

  return (
    <div className="h-full space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <NotesEditorWithMentions
          content={newNoteContent}
          onChange={setNewNoteContent}
          placeholder="Add a note..."
          disabled={createNoteMutation.isPending || !currentStaff}
          minHeight="80px"
        />
        <div className="flex justify-end gap-2">
          {createNoteMutation.isPending && (
            <span className="text-xs text-muted-foreground self-center">Posting...</span>
          )}
          <Button
            onClick={handleSubmit}
            disabled={
              isTiptapContentEmpty(newNoteContent) ||
              createNoteMutation.isPending ||
              !currentStaff
            }
            size="sm"
            variant="default"
          >
            Post
          </Button>
        </div>
      </div>

      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}
