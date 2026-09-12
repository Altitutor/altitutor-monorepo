'use client';

import { useCallback, useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityItem } from './ActivityItem';
import { mapActivityEventsToDisplay } from '../mappers';
import type { ActivityEventsResponse } from '../types';
import { activityKeys } from '../queryKeys';
import { useDeleteNote, useUpdateNote } from '@/shared/hooks/useNotes';
import { Button, Skeleton, useToast } from '@altitutor/ui';
import { cn } from '@/shared/utils';

interface ActivityFeedProps {
  data?: ActivityEventsResponse;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onOpenFormResponse?: (responseId: string) => void;
  chronological?: boolean;
}

export function ActivityFeed({
  data,
  isLoading,
  error,
  className,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onOpenFormResponse,
  chronological = false,
}: ActivityFeedProps) {
  const queryClient = useQueryClient();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { toast } = useToast();
  const activities = useMemo(() => {
    if (!data) return [];
    return mapActivityEventsToDisplay(data, { chronological });
  }, [data, chronological]);

  const refreshActivity = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: activityKeys.all });
  }, [queryClient]);

  const handleUpdateNote = useCallback(async (noteId: string, note: JSONContent) => {
    try {
      await updateNote.mutateAsync({ noteId, note });
      await refreshActivity();
      toast({ title: 'Note updated' });
    } catch (error) {
      toast({
        title: 'Could not update note',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [refreshActivity, toast, updateNote]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await deleteNote.mutateAsync(noteId);
      await refreshActivity();
      toast({ title: 'Note deleted' });
    } catch (error) {
      toast({
        title: 'Could not delete note',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [deleteNote, refreshActivity, toast]);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        <p>Failed to load activity feed</p>
        <p className="mt-1 text-xs">{error.message}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onOpenFormResponse={onOpenFormResponse}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          isUpdatingNote={updateNote.isPending}
          isDeletingNote={deleteNote.isPending}
        />
      ))}

      {hasNextPage && onLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
