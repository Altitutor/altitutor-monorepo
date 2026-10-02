"use client";

import { useCallback, useMemo } from "react";
import type { JSONContent } from "@tiptap/core";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityItem } from "./ActivityItem";
import { mapActivityEventsToDisplay } from "../mappers";
import type { CommunicationTimeSort } from "../lib/entityCommunication";
import type { ActivityNote, ActivityEventsResponse } from "../types";
import { activityKeys } from "../queryKeys";
import {
  useDeleteNote,
  useUpdateNote,
  useSetNoteAlert,
} from "@/shared/hooks/useNotes";
import { Button, Skeleton, useToast } from "@altitutor/ui";
import { cn } from "@/shared/utils";

interface ActivityFeedProps {
  data?: ActivityEventsResponse;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onOpenFormResponse?: (responseId: string) => void;
  notes?: ActivityNote[];
  chronological?: boolean;
  timeBasis?: CommunicationTimeSort;
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
  notes,
  chronological = false,
  timeBasis = "logged",
}: ActivityFeedProps) {
  const queryClient = useQueryClient();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const setNoteAlert = useSetNoteAlert();
  const { toast } = useToast();
  const activities = useMemo(() => {
    if (!data && !notes) return [];
    return mapActivityEventsToDisplay(
      data ?? { events: [], relatedEntities: {}, total: 0, hasMore: false },
      { chronological, timeBasis, notes },
    );
  }, [data, chronological, timeBasis, notes]);

  const refreshActivity = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: activityKeys.all });
  }, [queryClient]);

  const handleUpdateNote = useCallback(
    async (noteId: string, note: JSONContent, revision?: number) => {
      try {
        await updateNote.mutateAsync({ noteId, note, revision });
        await refreshActivity();
        toast({ title: "Note updated" });
      } catch (error) {
        toast({
          title: "Could not update note",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [refreshActivity, toast, updateNote],
  );

  const handleSetNoteAlert = async (
    noteId: string,
    isAlert: boolean,
    revision: number,
  ) => {
    try {
      await setNoteAlert.mutateAsync({ noteId, isAlert, revision });
      toast({ title: isAlert ? "Note flagged as an alert" : "Alert removed" });
    } catch (error) {
      toast({
        title: "Could not update alert",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      try {
        await deleteNote.mutateAsync(noteId);
        await refreshActivity();
        toast({ title: "Note deleted" });
      } catch (error) {
        toast({
          title: "Could not delete note",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [deleteNote, refreshActivity, toast],
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
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
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        <p>Failed to load activity feed</p>
        <p className="mt-1 text-xs">{error.message}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {chronological && hasNextPage && onLoadMore ? (
        <div className="flex justify-center pb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load earlier activity"}
          </Button>
        </div>
      ) : null}
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onOpenFormResponse={onOpenFormResponse}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onSetNoteAlert={handleSetNoteAlert}
          isSettingNoteAlert={setNoteAlert.isPending}
          isUpdatingNote={updateNote.isPending}
          isDeletingNote={deleteNote.isPending}
        />
      ))}

      {!chronological && hasNextPage && onLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
