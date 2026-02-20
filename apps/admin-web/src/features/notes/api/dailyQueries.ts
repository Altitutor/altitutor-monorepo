import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { dailyNotesApi } from './dailyNotes';
import { notesKeys } from './queryKeys';
import type { DailyNoteUpdate } from '../types';

export function useDailyNote(date: string, enabled = true) {
  return useQuery({
    queryKey: notesKeys.daily(date),
    queryFn: () => dailyNotesApi.ensureForDate(date),
    enabled: enabled && !!date,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
}

export type UpdateDailyNoteVariables = {
  id: string;
  date: string;
  updates: DailyNoteUpdate;
  silent?: boolean;
  /** Set by caller from useCurrentStaff(); used for updated_by when not in updates. */
  updatedBy?: string | null;
};

/**
 * Update a daily note. Caller must pass updatedBy (e.g. from useCurrentStaff()) when updates don't include updated_by.
 */
export function useUpdateDailyNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, date, updates, silent, updatedBy }: UpdateDailyNoteVariables) => {
      const updatesWithStaff: DailyNoteUpdate = {
        ...updates,
        updated_by: updates.updated_by ?? updatedBy ?? null,
      };
      const note = await dailyNotesApi.update(id, updatesWithStaff);
      return { note, date, silent };
    },
    onSuccess: ({ note, date }) => {
      queryClient.setQueryData(notesKeys.daily(date), note);
    },
    onError: (error: Error, variables) => {
      if (variables.silent) return;
      toast({
        title: 'Error',
        description: error.message || 'Failed to update daily note',
        variant: 'destructive',
      });
    },
  });
}
