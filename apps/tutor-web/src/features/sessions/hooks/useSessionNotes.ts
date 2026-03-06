import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@altitutor/ui';
import { notesApi } from '@/shared/api/notes';

export const sessionNotesKeys = {
  all: ['session-notes'] as const,
  forSession: (sessionId: string) => [...sessionNotesKeys.all, 'session', sessionId] as const,
};

/**
 * Get notes for a session
 */
export function useSessionNotes(sessionId: string) {
  return useQuery({
    queryKey: sessionNotesKeys.forSession(sessionId),
    queryFn: async () => {
      return notesApi.getNotesWithStaff({
        targetType: 'sessions',
        targetId: sessionId,
      });
    },
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Create a note for a session
 */
export function useCreateSessionNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      note: JSONContent | string;
    }) => {
      const response = await fetch(`/api/sessions/${params.sessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: params.note }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create note');
      }
      return await response.json();
    },
    onSuccess: (newNote, variables) => {
      // Invalidate session notes query
      queryClient.invalidateQueries({ queryKey: sessionNotesKeys.forSession(variables.sessionId) });
    },
  });
}

/**
 * Update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      noteId: string;
      note: JSONContent | string;
    }) => {
      const response = await fetch(`/api/notes/${params.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: params.note }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update note');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all session notes queries
      queryClient.invalidateQueries({ queryKey: sessionNotesKeys.all });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete note');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all session notes queries
      queryClient.invalidateQueries({ queryKey: sessionNotesKeys.all });
    },
  });
}

