import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsApi } from '../api';
import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { useToast } from '@altitutor/ui';

/**
 * React Query hooks for topics
 */

// Query keys
export const topicsKeys = {
  all: ['topics'] as const,
  byId: (id: string) => ['topics', id] as const,
  bySubject: (subjectId: string) => ['topics', 'subject', subjectId] as const,
  byParent: (parentId: string) => ['topics', 'parent', parentId] as const,
  hierarchy: (subjectId: string) => ['topics', 'hierarchy', subjectId] as const,
  roots: (subjectId: string) => ['topics', 'roots', subjectId] as const,
  withSubjects: () => ['topics', 'with-subjects'] as const,
};

/**
 * Get all topics
 */
export function useTopics() {
  return useQuery({
    queryKey: topicsKeys.all,
    queryFn: () => topicsApi.getAllTopics(),
  });
}

/**
 * Get a single topic by ID
 */
export function useTopicById(id: string | null) {
  return useQuery({
    queryKey: topicsKeys.byId(id!),
    queryFn: () => topicsApi.getTopic(id!),
    enabled: !!id,
  });
}

/**
 * Get topics by subject
 */
export function useTopicsBySubject(subjectId: string | null) {
  return useQuery({
    queryKey: topicsKeys.bySubject(subjectId!),
    queryFn: () => topicsApi.getTopicsBySubject(subjectId!),
    enabled: !!subjectId,
  });
}

/**
 * Get child topics of a parent
 */
export function useChildTopics(parentId: string | null) {
  return useQuery({
    queryKey: topicsKeys.byParent(parentId!),
    queryFn: () => topicsApi.getChildTopics(parentId!),
    enabled: !!parentId,
  });
}

/**
 * Get root topics for a subject
 */
export function useRootTopics(subjectId: string | null) {
  return useQuery({
    queryKey: topicsKeys.roots(subjectId!),
    queryFn: () => topicsApi.getRootTopics(subjectId!),
    enabled: !!subjectId,
  });
}

/**
 * Get topic hierarchy tree for a subject
 */
export function useTopicHierarchy(subjectId: string | null) {
  return useQuery({
    queryKey: topicsKeys.hierarchy(subjectId!),
    queryFn: () => topicsApi.getTopicHierarchy(subjectId!),
    enabled: !!subjectId,
  });
}

/**
 * Get topics with subjects
 */
export function useTopicsWithSubjects() {
  return useQuery({
    queryKey: topicsKeys.withSubjects(),
    queryFn: () => topicsApi.getTopicsWithSubjects(),
  });
}

/**
 * Create a topic
 */
export function useCreateTopic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: Omit<TablesInsert<'topics'>, 'index'>) => topicsApi.createTopic(data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      queryClient.invalidateQueries({ queryKey: topicsKeys.bySubject(data.subject_id) });
      if (data.parent_id) {
        queryClient.invalidateQueries({ queryKey: topicsKeys.byParent(data.parent_id) });
      } else {
        queryClient.invalidateQueries({ queryKey: topicsKeys.roots(data.subject_id) });
      }
      queryClient.invalidateQueries({ queryKey: topicsKeys.hierarchy(data.subject_id) });
      queryClient.invalidateQueries({ queryKey: topicsKeys.withSubjects() });
      
      toast({
        title: 'Success',
        description: 'Topic created successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to create topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to create topic',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update a topic
 */
export function useUpdateTopic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'topics'> }) =>
      topicsApi.updateTopic(id, data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      queryClient.invalidateQueries({ queryKey: topicsKeys.byId(data.id) });
      queryClient.invalidateQueries({ queryKey: topicsKeys.bySubject(data.subject_id) });
      if (data.parent_id) {
        queryClient.invalidateQueries({ queryKey: topicsKeys.byParent(data.parent_id) });
      }
      queryClient.invalidateQueries({ queryKey: topicsKeys.hierarchy(data.subject_id) });
      queryClient.invalidateQueries({ queryKey: topicsKeys.withSubjects() });
      
      toast({
        title: 'Success',
        description: 'Topic updated successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to update topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to update topic',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a topic
 */
export function useDeleteTopic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (id: string) => topicsApi.deleteTopic(id),
    onSuccess: () => {
      // Invalidate all topics queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      
      toast({
        title: 'Success',
        description: 'Topic deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to delete topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete topic',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Batch update topic indices
 */
export function useUpdateTopicIndices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (updates: Array<{ id: string; index: number }>) =>
      topicsApi.updateTopicIndices(updates),
    onSuccess: () => {
      // Invalidate all topics queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      
      toast({
        title: 'Success',
        description: 'Topic order updated successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to update topic order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update topic order',
        variant: 'destructive',
      });
    },
  });
}
