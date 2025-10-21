import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsApi } from '../api/topics';
import type { Tables, TablesUpdate, TablesInsert } from '@altitutor/shared';

// Query Keys
export const topicsKeys = {
  all: ['topics'] as const,
  lists: () => [...topicsKeys.all, 'list'] as const,
  list: (filters: string) => [...topicsKeys.lists(), { filters }] as const,
  details: () => [...topicsKeys.all, 'detail'] as const,
  detail: (id: string) => [...topicsKeys.details(), id] as const,
  withSubjects: () => [...topicsKeys.all, 'withSubjects'] as const,
  bySubject: (subjectId: string) => [...topicsKeys.all, 'bySubject', subjectId] as const,
  subtopics: {
    all: ['subtopics'] as const,
    lists: () => [...topicsKeys.subtopics.all, 'list'] as const,
    details: () => [...topicsKeys.subtopics.all, 'detail'] as const,
    detail: (id: string) => [...topicsKeys.subtopics.details(), id] as const,
    byTopic: (topicId: string) => [...topicsKeys.subtopics.all, 'byTopic', topicId] as const,
    withTopics: () => [...topicsKeys.subtopics.all, 'withTopics'] as const,
  },
};

// Get all topics
export function useTopics() {
  return useQuery({
    queryKey: topicsKeys.lists(),
    queryFn: topicsApi.getAllTopics,
    staleTime: 1000 * 60 * 5, // 5 minutes - topics don't change often
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get topics with subjects
export function useTopicsWithSubjects() {
  return useQuery({
    queryKey: topicsKeys.withSubjects(),
    queryFn: topicsApi.getTopicsWithSubjects,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get single topic
export function useTopic(topicId: string) {
  return useQuery({
    queryKey: topicsKeys.detail(topicId),
    queryFn: () => topicsApi.getTopic(topicId),
    enabled: !!topicId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get topics by subject
export function useTopicsBySubject(subjectId: string) {
  return useQuery({
    queryKey: topicsKeys.bySubject(subjectId),
    queryFn: () => topicsApi.getTopicsBySubject(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get subtopics by topic
export function useSubtopicsByTopic(topicId: string) {
  return useQuery({
    queryKey: topicsKeys.subtopics.byTopic(topicId),
    queryFn: () => topicsApi.getSubtopicsByTopic(topicId),
    enabled: !!topicId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get single subtopic
export function useSubtopic(subtopicId: string) {
  return useQuery({
    queryKey: topicsKeys.subtopics.detail(subtopicId),
    queryFn: () => topicsApi.getSubtopic(subtopicId),
    enabled: !!subtopicId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get all subtopics with topics
export function useSubtopicsWithTopics() {
  return useQuery({
    queryKey: topicsKeys.subtopics.withTopics(),
    queryFn: topicsApi.getAllSubtopicsWithTopics,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Topic Mutations
export function useCreateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: topicsApi.createTopic,
    onSuccess: (newTopic) => {
      // Invalidate and refetch topics lists
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      
      // Optimistically add the new topic to the cache
      queryClient.setQueryData(topicsKeys.lists(), (old: Tables<'topics'>[] | undefined) => {
        if (!old) return [newTopic];
        return [...old, newTopic];
      });
      
      // Also invalidate subject queries since topics are related to subjects
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'topics'> }) =>
      topicsApi.updateTopic(id, data),
    onSuccess: (updatedTopic, { id }) => {
      // Update the topic in the detail cache
      queryClient.setQueryData(topicsKeys.detail(id), updatedTopic);

      // Update in the main topics list
      queryClient.setQueryData(topicsKeys.lists(), (old: Tables<'topics'>[] | undefined) => {
        if (!old) return [updatedTopic];
        return old.map((topic) =>
          topic.id === id ? updatedTopic : topic
        );
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: topicsApi.deleteTopic,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: topicsKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(topicsKeys.lists(), (old: Tables<'topics'>[] | undefined) => {
        if (!old) return [];
        return old.filter((topic) => topic.id !== deletedId);
      });

      // Invalidate all topic queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      
      // Also invalidate subtopics since they depend on topics
      queryClient.invalidateQueries({ queryKey: topicsKeys.subtopics.all });
    },
  });
}

// Subtopic Mutations
export function useCreateSubtopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: topicsApi.createSubtopic,
    onSuccess: (newSubtopic) => {
      // Invalidate and refetch subtopics lists
      queryClient.invalidateQueries({ queryKey: topicsKeys.subtopics.all });
      
      // Invalidate the specific topic's subtopics
      if ((newSubtopic as Tables<'subtopics'>).topic_id) {
        queryClient.invalidateQueries({ 
          queryKey: topicsKeys.subtopics.byTopic((newSubtopic as Tables<'subtopics'>).topic_id) 
        });
      }
      
      // Also invalidate topic queries since subtopics are related to topics
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
    },
  });
}

export function useUpdateSubtopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'subtopics'> }) =>
      topicsApi.updateSubtopic(id, data),
    onSuccess: (updatedSubtopic, { id }) => {
      // Update the subtopic in the detail cache
      queryClient.setQueryData(topicsKeys.subtopics.detail(id), updatedSubtopic);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.subtopics.all });
      
      // Invalidate the specific topic's subtopics
      if ((updatedSubtopic as Tables<'subtopics'>).topic_id) {
        queryClient.invalidateQueries({ 
          queryKey: topicsKeys.subtopics.byTopic((updatedSubtopic as Tables<'subtopics'>).topic_id) 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
    },
  });
}

export function useDeleteSubtopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: topicsApi.deleteSubtopic,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: topicsKeys.subtopics.detail(deletedId) });

      // Invalidate all subtopic queries
      queryClient.invalidateQueries({ queryKey: topicsKeys.subtopics.all });
      queryClient.invalidateQueries({ queryKey: topicsKeys.all });
    },
  });
} 