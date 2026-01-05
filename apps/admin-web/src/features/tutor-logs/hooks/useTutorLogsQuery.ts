import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorLogsApi } from '../api/tutor-logs';
import { sessionsKeys } from '../../sessions/hooks/useSessionsQuery';
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
 * Get all tutor logs with pagination support
 */
export function useTutorLogs(params?: { limit?: number; offset?: number; dateFrom?: string; dateTo?: string }) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  const limit = params?.limit;
  const offset = params?.offset;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const queryKey = [...tutorLogsKeys.lists(), limit, offset, dateFrom, dateTo];
  
  return useQuery({
    queryKey: queryKey,
    queryFn: () => tutorLogsApi.getAllTutorLogs(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Search tutor logs with filters and relationships
 * Filters by session date (Adelaide timezone), not tutor log created date
 */
export function useSearchTutorLogs(args?: {
  search?: string;
  rangeStart?: string; // YYYY-MM-DD format (Adelaide timezone)
  rangeEnd?: string; // YYYY-MM-DD format (Adelaide timezone)
  staffId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'session_start_at' | 'created_at';
  ascending?: boolean;
}) {
  const search = args?.search;
  const rangeStart = args?.rangeStart;
  const rangeEnd = args?.rangeEnd;
  const staffId = args?.staffId;
  const limit = args?.limit;
  const offset = args?.offset;
  const orderBy = args?.orderBy;
  const ascending = args?.ascending;
  
  return useQuery({
    queryKey: [...tutorLogsKeys.lists(), 'search', search, rangeStart, rangeEnd, staffId, limit, offset, orderBy, ascending],
    queryFn: () => tutorLogsApi.searchTutorLogs(args),
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
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
    staleTime: 1000 * 60 * 2, // 2 minutes - reduce constant refetching
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
      
      // Invalidate sessions queries since they show log status (using proper key constants)
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      
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
      
      // Invalidate sessions queries (using proper key constants)
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    },
  });
}


