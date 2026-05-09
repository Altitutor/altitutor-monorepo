import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';

// Query Keys
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters: string) => [...sessionsKeys.lists(), { filters }] as const,
  listRange: (rangeStart: string, rangeEnd: string) =>
    [...sessionsKeys.lists(), 'range', rangeStart, rangeEnd] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
  detailsBatch: (sessionIds: string[]) =>
    [...sessionsKeys.all, 'details-batch', [...sessionIds].sort().join(',')] as const,
};

// Get all sessions (uses vtutor_sessions view)
export function useSessions() {
  return useQuery({
    queryKey: sessionsKeys.lists(),
    queryFn: sessionsApi.getAllSessions,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/** Upcoming sessions in a calendar range (YYYY-MM-DD), for dashboard / focused lists */
export function useTutorSessionsInRange(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: sessionsKeys.listRange(rangeStart, rangeEnd),
    queryFn: () => sessionsApi.getSessionsInDateRange(rangeStart, rangeEnd),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 5,
  });
}

export function useTutorSessionDetailsBatch(sessionIds: string[]) {
  const uniqueSorted = [...new Set(sessionIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: sessionsKeys.detailsBatch(uniqueSorted),
    queryFn: () => sessionsApi.getSessionsWithDetails(uniqueSorted),
    enabled: uniqueSorted.length > 0,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

// Get single session with details (uses vtutor_session_detail view)
export function useSessionWithDetails(sessionId: string) {
  return useQuery({
    queryKey: sessionsKeys.detail(sessionId),
    queryFn: () => sessionsApi.getSessionWithDetails(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Get single session (basic, uses vtutor_sessions view)
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: [...sessionsKeys.detail(sessionId), 'basic'],
    queryFn: () => sessionsApi.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
