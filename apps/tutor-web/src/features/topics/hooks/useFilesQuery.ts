import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '../api';
import type { Tables } from '@altitutor/shared';
import { useToast } from '@altitutor/ui';

/**
 * React Query hooks for files
 */

// Query keys
export const filesKeys = {
  all: ['files'] as const,
  byId: (id: string) => ['files', id] as const,
  withSignedUrl: (id: string) => ['files', 'signed-url', id] as const,
};

/**
 * Get all files
 */
export function useFiles(includeSoftDeleted = false) {
  return useQuery({
    queryKey: [...filesKeys.all, includeSoftDeleted],
    queryFn: () => filesApi.getAllFiles(includeSoftDeleted),
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

/**
 * Upload a file
 */
export function useUploadFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (params: { subjectId: string; topicId: string; file: File }) =>
      filesApi.uploadFile(params),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: filesKeys.all });
      queryClient.invalidateQueries({ queryKey: filesKeys.byId(data.id) });
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to upload file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Soft delete a file
 */
export function useSoftDeleteFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (id: string) => filesApi.softDeleteFile(id),
    onSuccess: () => {
      // Invalidate all files queries
      queryClient.invalidateQueries({ queryKey: filesKeys.all });
      
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to delete file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Restore a soft-deleted file
 */
export function useRestoreFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (id: string) => filesApi.restoreFile(id),
    onSuccess: () => {
      // Invalidate all files queries
      queryClient.invalidateQueries({ queryKey: filesKeys.all });
      
      toast({
        title: 'Success',
        description: 'File restored successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to restore file:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore file',
        variant: 'destructive',
      });
    },
  });
}

