import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsFilesApi } from '../api';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
import { useToast } from '@altitutor/ui';

/**
 * React Query hooks for topics_files
 */

// Query keys
export const topicsFilesKeys = {
  all: ['topics-files'] as const,
  byId: (id: string) => ['topics-files', id] as const,
  byTopic: (topicId: string) => ['topics-files', 'topic', topicId] as const,
  byTopicAndType: (topicId: string, type: Enums<'resource_type'>) =>
    ['topics-files', 'topic', topicId, 'type', type] as const,
  solutionLinks: (topicId: string, type: Enums<'resource_type'>) =>
    ['topics-files', 'solution-links', topicId, type] as const,
};

/**
 * Get all topic files
 */
export function useTopicsFiles() {
  return useQuery({
    queryKey: topicsFilesKeys.all,
    queryFn: () => topicsFilesApi.getAllTopicFiles(),
  });
}

/**
 * Get a single topic file by ID
 */
export function useTopicFileById(id: string | null) {
  return useQuery({
    queryKey: topicsFilesKeys.byId(id!),
    queryFn: () => topicsFilesApi.getTopicFile(id!),
    enabled: !!id,
  });
}

/**
 * Get topic files for a topic
 */
export function useTopicFilesByTopic(topicId: string | null) {
  return useQuery({
    queryKey: topicsFilesKeys.byTopic(topicId!),
    queryFn: () => topicsFilesApi.getTopicFilesByTopic(topicId!),
    enabled: !!topicId,
  });
}

/**
 * Get topic files by type
 */
export function useTopicFilesByType(topicId: string | null, type: Enums<'resource_type'>) {
  return useQuery({
    queryKey: topicsFilesKeys.byTopicAndType(topicId!, type),
    queryFn: () => topicsFilesApi.getTopicFilesByType(topicId!, type),
    enabled: !!topicId,
  });
}

/**
 * Get available solution links
 */
export function useAvailableSolutionLinks(topicId: string | null, type: Enums<'resource_type'> | null) {
  return useQuery({
    queryKey: topicsFilesKeys.solutionLinks(topicId!, type!),
    queryFn: () => topicsFilesApi.getAvailableSolutionLinks(topicId!, type!),
    enabled: !!topicId && !!type,
  });
}

/**
 * Create a topic file
 */
export function useCreateTopicFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: Omit<TablesInsert<'topics_files'>, 'index'>) =>
      topicsFilesApi.createTopicFile(data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.all });
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.byTopic(data.topic_id) });
      queryClient.invalidateQueries({
        queryKey: topicsFilesKeys.byTopicAndType(data.topic_id, data.type),
      });
      
      toast({
        title: 'Success',
        description: 'Resource file added successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to create topic file:', error);
      toast({
        title: 'Error',
        description: 'Failed to add resource file',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update a topic file
 */
export function useUpdateTopicFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'topics_files'> }) =>
      topicsFilesApi.updateTopicFile(id, data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.all });
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.byId(data.id) });
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.byTopic(data.topic_id) });
      
      toast({
        title: 'Success',
        description: 'Resource file updated successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to update topic file:', error);
      toast({
        title: 'Error',
        description: 'Failed to update resource file',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a topic file
 */
export function useDeleteTopicFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (id: string) => topicsFilesApi.deleteTopicFile(id),
    onSuccess: () => {
      // Invalidate all topic files queries
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.all });
      
      toast({
        title: 'Success',
        description: 'Resource file deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to delete topic file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete resource file',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Batch update topic file indices
 */
export function useUpdateTopicFileIndices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (updates: Array<{ id: string; index: number }>) =>
      topicsFilesApi.updateTopicFileIndices(updates),
    onSuccess: () => {
      // Invalidate all topic files queries
      queryClient.invalidateQueries({ queryKey: topicsFilesKeys.all });
      
      toast({
        title: 'Success',
        description: 'Resource file order updated successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to update resource file order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update resource file order',
        variant: 'destructive',
      });
    },
  });
}

