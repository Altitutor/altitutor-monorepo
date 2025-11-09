import { useQuery } from '@tanstack/react-query';
import { topicsApi } from '../api';

/**
 * React Query hooks for topics - tutor-web
 * 
 * IMPORTANT: Tutors can only READ topics through views
 * All writes (create/update topics) must go through API routes
 */

// Query keys
export const topicsKeys = {
  all: ['topics'] as const,
  bySubject: (subjectId: string) => ['topics', 'subject', subjectId] as const,
  subjectResources: () => ['topics', 'subject-resources'] as const,
};

/**
 * Get all topics accessible to the current tutor
 * Uses vtutor_topics view
 */
export function useTopics() {
  return useQuery({
    queryKey: topicsKeys.all,
    queryFn: () => topicsApi.getAllTopics(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Get topics by subject
 * Uses vtutor_topics view or filters vtutor_subject_resources
 */
export function useTopicsBySubject(subjectId: string | null) {
  return useQuery({
    queryKey: topicsKeys.bySubject(subjectId!),
    queryFn: () => topicsApi.getTopicsBySubject(subjectId!),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
