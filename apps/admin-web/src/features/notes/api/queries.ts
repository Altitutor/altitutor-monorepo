import { useQuery } from '@tanstack/react-query';
import { notesApi } from './notes';
import { foldersApi } from './folders';
import { notesKeys, foldersKeys } from './queryKeys';

/**
 * Get all notes with optional filters
 */
export function useNotes(
  filters?: { folderId?: string | null; projectId?: string | null; search?: string },
  enabled = true
) {
  return useQuery({
    queryKey: notesKeys.list(filters),
    queryFn: () => notesApi.list(filters),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get notes by folder ID
 */
export function useNotesByFolder(folderId: string, enabled = true) {
  return useQuery({
    queryKey: [...notesKeys.lists(), 'folder', folderId],
    queryFn: () => notesApi.listByFolder(folderId),
    enabled: enabled && !!folderId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single note by ID
 */
export function useNote(noteId: string, enabled = true) {
  return useQuery({
    queryKey: notesKeys.detail(noteId),
    queryFn: () => notesApi.get(noteId),
    enabled: enabled && !!noteId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get all folders
 */
export function useFolders() {
  return useQuery({
    queryKey: foldersKeys.list(),
    queryFn: () => foldersApi.list(),
    staleTime: 1000 * 60 * 5, // 5 minutes - folders change less frequently
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get root folders (folders with no parent)
 */
export function useRootFolders() {
  return useQuery({
    queryKey: foldersKeys.root(),
    queryFn: () => foldersApi.listRoot(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get folders by parent ID
 */
export function useFoldersByParent(parentId: string, enabled = true) {
  return useQuery({
    queryKey: foldersKeys.byParent(parentId),
    queryFn: () => foldersApi.listByParent(parentId),
    enabled: enabled && !!parentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get a single folder by ID
 */
export function useFolder(folderId: string, enabled = true) {
  return useQuery({
    queryKey: foldersKeys.detail(folderId),
    queryFn: () => foldersApi.get(folderId),
    enabled: enabled && !!folderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get folder tree with notes (recursive structure)
 */
export function useFolderTree() {
  return useQuery({
    queryKey: foldersKeys.tree(),
    queryFn: () => foldersApi.getTree(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
