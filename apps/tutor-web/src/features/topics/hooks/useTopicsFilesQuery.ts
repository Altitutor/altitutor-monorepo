import { useQuery } from '@tanstack/react-query';
import { topicsFilesApi } from '../api/topics-files';
import type { Enums } from '@altitutor/shared';

/**
 * React Query hooks for topics_files
 */

// Query keys
export const topicsFilesKeys = {
  all: ['topics-files'] as const,
  byId: (id: string) => ['topics-files', id] as const,
  byIds: (ids: string[]) => ['topics-files', 'by-ids', ids.sort().join(',')] as const,
  byTopic: (topicId: string) => ['topics-files', 'topic', topicId] as const,
  byTopicAndType: (topicId: string, type: Enums<'resource_type'>) =>
    ['topics-files', 'topic', topicId, 'type', type] as const,
  solutionLinks: (topicId: string, type: Enums<'resource_type'>) =>
    ['topics-files', 'solution-links', topicId, type] as const,
};

/**
 * Get all topic files
 * Note: Tutors can only read topic files through views, not directly
 */
export function useTopicsFiles() {
  return useQuery({
    queryKey: topicsFilesKeys.all,
    queryFn: () => Promise.resolve([]), // Topic files come from views, not direct API
    enabled: false, // Disabled - tutors don't need to list all topic files
  });
}

/**
 * Get a single topic file by ID
 * Note: Tutors can only read topic files through views
 * This is a placeholder - topic files come from views, not direct API
 */
export function useTopicFileById(id: string | null) {
  return useQuery({
    queryKey: topicsFilesKeys.byId(id!),
    queryFn: () => Promise.resolve(null), // Topic files come from views, not direct API
    enabled: false, // Disabled - tutors don't need to fetch individual topic files
  });
}

/**
 * Get topic files for a topic
 * Uses vtutor_topics_files view
 */
export function useTopicFilesByTopic(topicId: string | null) {
  return useQuery({
    queryKey: topicsFilesKeys.byTopic(topicId ?? ''),
    queryFn: () => topicsFilesApi.getTopicFilesByTopic(topicId!),
    enabled: !!topicId,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

/**
 * Get topic files by IDs
 * Uses vtutor_topics_files view
 */
export function useTopicFilesByIds(ids: string[]) {
  return useQuery({
    queryKey: topicsFilesKeys.byIds(ids),
    queryFn: () => topicsFilesApi.getTopicFilesByIds(ids),
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Remaining hooks removed - tutors must use API routes for writes
// export function useTopicFilesByType() { ... }
// export function useAvailableSolutionLinks() { ... }
// export function useCreateTopicFile() { ... }
// export function useUpdateTopicFile() { ... }
// export function useDeleteTopicFile() { ... }
// export function useUpdateTopicFileIndices() { ... }

