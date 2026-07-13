'use client';

import { useState, useCallback } from 'react';
import { ActivityFeed } from '../ActivityFeed';
import { ActivityNoteComposer } from '../ActivityNoteComposer';
import { useSessionActivity } from '../../hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';
import type { JSONContent } from '@tiptap/core';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { SessionFormResponseDialog } from '@/features/forms/components/SessionFormResponseDialog';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface SessionActivityTabProps {
  sessionId: string;
  isOpen?: boolean;
}

export function SessionActivityTab({ sessionId, isOpen = true }: SessionActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSessionActivity(sessionId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'sessions',
        targetId: sessionId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget('sessions', sessionId) });
      queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) });
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, sessionId, createNoteMutation, queryClient]);

  return (
    <div className="h-full space-y-6">
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setFormDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add form response
          </Button>
        </div>
        <ActivityNoteComposer content={newNoteContent} onChange={setNewNoteContent} onSubmit={handleSubmit} isSubmitting={createNoteMutation.isPending} canPost={Boolean(currentStaff)} />
      </div>

      <ActivityFeed
        data={data}
        isLoading={isLoading}
        error={error}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
      <SessionFormResponseDialog
        sessionId={sessionId}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) })}
      />
    </div>
  );
}
