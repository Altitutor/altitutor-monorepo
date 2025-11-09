import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorLogsApi } from '../api/tutor-logs';
import type { TutorLogFormData } from '../types';

// Query Keys
export const tutorLogsKeys = {
  all: ['tutor-logs'] as const,
  lists: () => [...tutorLogsKeys.all, 'list'] as const,
  list: (filters: string) => [...tutorLogsKeys.lists(), { filters }] as const,
  details: () => [...tutorLogsKeys.all, 'detail'] as const,
  detail: (id: string) => [...tutorLogsKeys.details(), id] as const,
  forSession: (sessionId: string) => [...tutorLogsKeys.all, 'forSession', sessionId] as const,
  unlogged: (staffId: string) => [...tutorLogsKeys.all, 'unlogged', staffId] as const,
};

/**
 * Get all tutor logs
 */
export function useTutorLogs() {
  return useQuery({
    queryKey: tutorLogsKeys.lists(),
    queryFn: tutorLogsApi.getAllTutorLogs,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get a single tutor log with details
 */
export function useTutorLog(id: string) {
  return useQuery({
    queryKey: tutorLogsKeys.detail(id),
    queryFn: () => tutorLogsApi.getTutorLogWithDetails(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Check if a session has been logged
 * Note: This would need to query vtutor_tutor_log by session_id
 * For now, returns null - would need API support
 */
export function useTutorLogForSession(sessionId: string) {
  return useQuery({
    queryKey: tutorLogsKeys.forSession(sessionId),
    queryFn: () => {
      // TODO: Implement getTutorLogForSession in API if needed
      return Promise.resolve(null);
    },
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get unlogged sessions for a staff member
 * Note: This would need to query sessions and check for logs
 * For now, returns empty array - would need API support
 */
export function useUnloggedSessions(staffId: string) {
  return useQuery({
    queryKey: tutorLogsKeys.unlogged(staffId),
    queryFn: () => {
      // TODO: Implement getUnloggedSessions in API if needed
      return Promise.resolve([]);
    },
    enabled: !!staffId,
    staleTime: 0, // Always refetch to ensure we have the latest data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a tutor log
 * Note: Tutors create logs via API route POST /api/tutor-logs
 */
export function useCreateTutorLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data }: { data: TutorLogFormData }) => {
      const response = await fetch('/api/tutor-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tutor log');
      }
      return await response.json();
    },
    onSuccess: (newLog: any) => {
      // Invalidate all tutor logs queries
      queryClient.invalidateQueries({ queryKey: tutorLogsKeys.all });
      
      // Invalidate sessions queries since they show log status
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      
      // Set the new log in cache if we have an ID
      if (newLog?.id) {
        queryClient.setQueryData(tutorLogsKeys.detail(newLog.id), newLog);
      }
      if (newLog?.session_id) {
        queryClient.setQueryData(tutorLogsKeys.forSession(newLog.session_id), newLog);
      }
    },
  });
}

/**
 * Delete a tutor log
 * Note: Tutors typically can't delete logs, but if needed, would use API route
 */
export function useDeleteTutorLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tutor-logs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete tutor log');
      }
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: tutorLogsKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: tutorLogsKeys.lists() });
    },
  });
}


