import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorLogsApi } from '../api/tutor-logs';
import type { TutorLogFormData } from '../types';
import { sessionsKeys } from '../../sessions/hooks/useSessionsQuery';

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
 */
export function useTutorLogForSession(sessionId: string) {
  return useQuery({
    queryKey: tutorLogsKeys.forSession(sessionId),
    queryFn: () => tutorLogsApi.getTutorLogForSession(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get unlogged sessions for a staff member
 */
export function useUnloggedSessions(staffId: string) {
  return useQuery({
    queryKey: tutorLogsKeys.unlogged(staffId),
    queryFn: () => tutorLogsApi.getUnloggedSessions(staffId),
    enabled: !!staffId,
    staleTime: 0, // Always refetch to ensure we have the latest data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a tutor log
 */
export function useCreateTutorLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: TutorLogFormData }) =>
      tutorLogsApi.createTutorLog(data),
    onSuccess: (result, variables) => {
      // Invalidate all tutor logs queries
      queryClient.invalidateQueries({ queryKey: tutorLogsKeys.all });
      
      // Invalidate sessions queries since they show log status
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      
      // Invalidate unlogged sessions query
      if (variables.data.sessionId) {
        queryClient.invalidateQueries({ queryKey: tutorLogsKeys.forSession(variables.data.sessionId) });
      }
      
      // Set the new log in cache if we have an ID
      if (result?.tutorLogId) {
        queryClient.invalidateQueries({ queryKey: tutorLogsKeys.detail(result.tutorLogId) });
      }
      if (variables.data.sessionId) {
        queryClient.invalidateQueries({ queryKey: tutorLogsKeys.forSession(variables.data.sessionId) });
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


