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
 * Note: Tutors can only read topic files through views
 */
export function useTopicFilesByTopic(topicId: string | null) {
  return useQuery({
    queryKey: topicsFilesKeys.byTopic(topicId!),
    queryFn: () => topicsFilesApi.getTopicFilesByTopic(topicId!),
    enabled: !!topicId,
  });
}

// Remaining hooks removed - tutors must use API routes for writes
// export function useTopicFilesByType() { ... }
// export function useAvailableSolutionLinks() { ... }
// export function useCreateTopicFile() { ... }
// export function useUpdateTopicFile() { ... }
// export function useDeleteTopicFile() { ... }
// export function useUpdateTopicFileIndices() { ... }

