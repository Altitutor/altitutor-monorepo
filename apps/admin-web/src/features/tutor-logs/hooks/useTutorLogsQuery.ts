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
    queryFn: () => tutorLogsApi.getTutorLog(id),
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
    mutationFn: ({ data, createdBy }: { data: TutorLogFormData; createdBy: string }) =>
      tutorLogsApi.createTutorLog(data, createdBy),
    onSuccess: (newLog) => {
      // Invalidate all tutor logs queries
      queryClient.invalidateQueries({ queryKey: tutorLogsKeys.all });
      
      // Invalidate sessions queries since they show log status
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      
      // Set the new log in cache
      queryClient.setQueryData(tutorLogsKeys.detail(newLog.id), newLog);
      queryClient.setQueryData(tutorLogsKeys.forSession(newLog.session_id), newLog);
    },
  });
}

/**
 * Delete a tutor log (admin only)
 */
export function useDeleteTutorLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tutorLogsApi.deleteTutorLog,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: tutorLogsKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: tutorLogsKeys.all });
      
      // Invalidate sessions queries
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}


