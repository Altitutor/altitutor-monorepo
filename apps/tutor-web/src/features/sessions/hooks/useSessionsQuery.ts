import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';

// Query Keys
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters: string) => [...sessionsKeys.lists(), { filters }] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
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
