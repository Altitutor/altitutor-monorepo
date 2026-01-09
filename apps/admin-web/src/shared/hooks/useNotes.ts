import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { notesApi } from '@/shared/api/notes';
import type { Tables } from '@altitutor/shared';

export const notesKeys = {
  all: ['notes'] as const,
  forTarget: (targetType: string, targetId: string) => 
    [...notesKeys.all, targetType, targetId] as const,
};

/**
 * Get notes for a specific target
 */
export function useNotes(targetType: string, targetId: string, enabled = true) {
  return useQuery({
    queryKey: notesKeys.forTarget(targetType, targetId),
    queryFn: () => notesApi.getNotesWithStaff({ targetType, targetId }),
    enabled: enabled && !!targetId,
  });
}

/**
 * Create a note for any target type
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      targetType: string;
      targetId: string;
      note: string;
      staffId: string;
    }) => {
      return notesApi.createNote({
        targetType: params.targetType,
        targetId: params.targetId,
        note: params.note,
        staffId: params.staffId,
      });
    },
    onSuccess: (newNote, variables) => {
      // Invalidate notes for this specific target
      queryClient.invalidateQueries({ 
        queryKey: notesKeys.forTarget(variables.targetType, variables.targetId) 
      });
      // Also invalidate related queries based on target type
      // Handle both singular and plural forms for backward compatibility
      if (variables.targetType === 'student' || variables.targetType === 'students') {
        queryClient.invalidateQueries({ queryKey: ['students'] });
      } else if (variables.targetType === 'class' || variables.targetType === 'classes') {
        queryClient.invalidateQueries({ queryKey: ['classes'] });
      } else if (variables.targetType === 'staff') {
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } else if (variables.targetType === 'session' || variables.targetType === 'sessions') {
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } else if (variables.targetType === 'task' || variables.targetType === 'tasks') {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else if (variables.targetType === 'parent' || variables.targetType === 'parents') {
        queryClient.invalidateQueries({ queryKey: ['parents'] });
      }
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
      // Invalidate all notes queries
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
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
      // Invalidate all notes queries
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
    },
  });
}







