import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from './notes';
import { foldersApi } from './folders';
import { notesKeys, foldersKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { NoteInsert, NoteUpdate, FolderInsert, FolderUpdate } from '../types';
import { useCurrentStaff } from '@/features/staff/hooks';

/**
 * Create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  return useMutation({
    mutationFn: async (note: Omit<NoteInsert, 'created_by'>) => {
      if (!currentStaff?.id) {
        throw new Error('Must be logged in to create notes');
      }
      const noteWithCreator: NoteInsert = {
        ...note,
        created_by: currentStaff.id,
      };
      return notesApi.create(noteWithCreator);
    },
    onSuccess: () => {
      // Invalidate notes lists
      queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
      // Invalidate folder tree (includes notes)
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });
      toast({
        title: 'Note created',
        description: 'The note has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create note',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  return useMutation({
    mutationFn: async ({ id, updates, silent }: { id: string; updates: NoteUpdate; silent?: boolean }) => {
      const updatesWithUpdater: NoteUpdate = {
        ...updates,
        updated_by: currentStaff?.id ?? null,
      };
      const result = await notesApi.update(id, updatesWithUpdater);
      return { note: result, silent };
    },
    onSuccess: ({ note: updatedNote, silent }, { id }) => {
      // Update specific note in cache
      queryClient.setQueryData(notesKeys.detail(id), updatedNote);

      // For silent auto-saves, only update cache, don't invalidate (prevents refetch loop)
      if (silent) {
        // Still update lists/tree cache if they exist, but don't invalidate to prevent refetch
        // This is fine because the detail query is the source of truth
        return;
      }

      // For manual saves, invalidate lists/tree so they show updated data
      queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update note',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (noteId: string) => notesApi.delete(noteId),
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: notesKeys.detail(deletedId) });

      // Invalidate notes lists
      queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
      // Invalidate folder tree
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });

      toast({
        title: 'Note deleted',
        description: 'The note has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete note',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Create a new folder
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  return useMutation({
    mutationFn: async (folder: Omit<FolderInsert, 'created_by'>) => {
      if (!currentStaff?.id) {
        throw new Error('Must be logged in to create folders');
      }
      const folderWithCreator: FolderInsert = {
        ...folder,
        created_by: currentStaff.id,
      };
      return foldersApi.create(folderWithCreator);
    },
    onSuccess: () => {
      // Invalidate folders lists
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: foldersKeys.root() });
      // Invalidate folder tree
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });
      toast({
        title: 'Folder created',
        description: 'The folder has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create folder',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update a folder
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: FolderUpdate }) =>
      foldersApi.update(id, updates),
    onSuccess: (updatedFolder, { id }) => {
      // Update specific folder in cache
      queryClient.setQueryData(foldersKeys.detail(id), updatedFolder);

      // Invalidate folders lists
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: foldersKeys.root() });
      // Invalidate folder tree
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });

      toast({
        title: 'Folder updated',
        description: 'The folder has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update folder',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a folder
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (folderId: string) => foldersApi.delete(folderId),
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: foldersKeys.detail(deletedId) });

      // Invalidate folders lists
      queryClient.invalidateQueries({ queryKey: foldersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: foldersKeys.root() });
      // Invalidate folder tree
      queryClient.invalidateQueries({ queryKey: foldersKeys.tree() });

      toast({
        title: 'Folder deleted',
        description: 'The folder has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete folder',
        variant: 'destructive',
      });
    },
  });
}
