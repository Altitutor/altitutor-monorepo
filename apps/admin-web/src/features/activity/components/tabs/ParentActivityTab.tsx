'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ActivityFeed } from '../ActivityFeed';
import { useParentActivity } from '../../hooks';
import { useNotes, useCreateNote } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';

interface ParentActivityTabProps {
  parentId: string;
  isOpen?: boolean;
}

export function ParentActivityTab({ parentId, isOpen = true }: ParentActivityTabProps) {
  const { data, isLoading, error } = useParentActivity(parentId, isOpen);
  const { data: notes = [] } = useNotes('parent', parentId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newNote]);

  const handleSubmit = async () => {
    if (!newNote.trim() || !currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'parent',
        targetId: parentId,
        note: newNote.trim(),
        staffId: currentStaff.id,
      });
      setNewNote('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      queryClient.invalidateQueries({ queryKey: ['notes', 'parent', parentId] });
      queryClient.invalidateQueries({ queryKey: activityKeys.parent(parentId) });
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-full space-y-6">
      {/* Add Note Input */}
      <div className="relative rounded-lg border bg-card p-4">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          className="min-h-[80px] resize-none border-0 bg-transparent pr-20 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={createNoteMutation.isPending || !currentStaff}
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          {createNoteMutation.isPending && (
            <span className="text-xs text-muted-foreground">Posting...</span>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!newNote.trim() || createNoteMutation.isPending || !currentStaff}
            size="sm"
            variant="default"
          >
            Post
          </Button>
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed data={data} isLoading={isLoading} error={error} />
    </div>
  );
}

