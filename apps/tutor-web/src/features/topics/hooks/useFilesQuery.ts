import { useQuery } from '@tanstack/react-query';
import { filesApi } from '../api';

/**
 * React Query hooks for files - tutor-web
 * 
 * IMPORTANT: Tutors can only READ file metadata, not upload/delete
 * All writes must go through API routes
 */

// Query keys
export const filesKeys = {
  all: ['files'] as const,
  byId: (id: string) => ['files', id] as const,
  withSignedUrl: (id: string) => ['files', 'signed-url', id] as const,
};

/**
 * Get all files
 * Note: Tutors can only read file metadata, not upload/delete
 * This hook is disabled as tutors don't need to list all files
 */
export function useFiles(includeSoftDeleted = false) {
  return useQuery({
    queryKey: [...filesKeys.all, includeSoftDeleted],
    queryFn: () => Promise.resolve([]), // Files come from views, not direct API
    enabled: false, // Disabled - tutors don't need to list all files
  });
}

/**
 * Get a single file by ID
 */
export function useFileById(id: string | null) {
  return useQuery({
    queryKey: filesKeys.byId(id!),
    queryFn: () => filesApi.getFile(id!),
    enabled: !!id,
  });
}

/**
 * Get file with signed URL
 */
export function useFileWithSignedUrl(id: string | null) {
  return useQuery({
    queryKey: filesKeys.withSignedUrl(id!),
    queryFn: () => filesApi.getFileWithSignedUrl(id!),
    enabled: !!id,
    // Signed URLs expire, so we want to refetch periodically
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Upload/delete/restore hooks removed - tutors must use API routes
// export function useUploadFile() { ... }
// export function useSoftDeleteFile() { ... }
// export function useRestoreFile() { ... }
