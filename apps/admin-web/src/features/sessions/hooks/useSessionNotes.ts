import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/shared/api/notes';

export const sessionNotesKeys = {
  all: ['session-notes'] as const,
  forSession: (sessionId: string) => [...sessionNotesKeys.all, 'session', sessionId] as const,
};

/**
 * Create a note for a session
 */
export function useCreateSessionNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      note: string;
      staffId: string;
    }) => {
      return notesApi.createNote({
        targetType: 'sessions',
        targetId: params.sessionId,
        note: params.note,
        staffId: params.staffId,
      });
    },
    onSuccess: (_newNote, _variables) => {
      // Invalidate all session queries to refetch notes
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
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
      note: string;
    }) => {
      return notesApi.updateNote(params.noteId, params.note);
    },
    onSuccess: () => {
      // Invalidate all session queries to refetch notes
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
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
      return notesApi.deleteNote(noteId);
    },
    onSuccess: () => {
      // Invalidate all session queries to refetch notes
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
