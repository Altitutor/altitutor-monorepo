import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters: string) => [...sessionsKeys.lists(), { filters }] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
  withDetails: () => [...sessionsKeys.all, 'withDetails'] as const,
  forStudent: (studentId: string) => [...sessionsKeys.all, 'forStudent', studentId] as const,
  forStaff: (staffId: string) => [...sessionsKeys.all, 'forStaff', staffId] as const,
};

// Get all sessions with details (optimized query)
export function useSessionsWithDetails(args?: { rangeStart?: string; rangeEnd?: string }) {
  return useQuery({
    queryKey: [...sessionsKeys.withDetails(), args?.rangeStart ?? null, args?.rangeEnd ?? null],
    queryFn: () => sessionsApi.getAllSessionsWithDetails(args),
    staleTime: 1000 * 60 * 1, // 1 minute - sessions change frequently
    gcTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Get all sessions (basic)
export function useSessions() {
  return useQuery({
    queryKey: sessionsKeys.lists(),
    queryFn: sessionsApi.getAllSessions,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single session with details
export function useSessionWithDetails(sessionId: string) {
  return useQuery({
    queryKey: sessionsKeys.detail(sessionId),
    queryFn: () => sessionsApi.getSessionWithDetails(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Get single session (basic)
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: [...sessionsKeys.detail(sessionId), 'basic'],
    queryFn: () => sessionsApi.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get sessions for a specific student
export function useSessionsForStudent(studentId: string) {
  return useQuery({
    queryKey: sessionsKeys.forStudent(studentId),
    queryFn: () => sessionsApi.getSessionsForStudent(studentId),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get sessions for a specific staff member
export function useSessionsForStaff(staffId: string) {
  return useQuery({
    queryKey: sessionsKeys.forStaff(staffId),
    queryFn: () => sessionsApi.getSessionsForStaff(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutations
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sessionsApi.createSession,
    onSuccess: (newSession) => {
      // Invalidate and refetch sessions lists
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      
      // Optimistically add the new session to the cache
      queryClient.setQueryData(sessionsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sessions: [...(old.sessions || []), newSession],
          sessionStudents: { ...old.sessionStudents, [newSession.id]: [] },
          sessionStaff: { ...old.sessionStaff, [newSession.id]: [] },
        };
      });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'sessions'> }) =>
      sessionsApi.updateSession(id, data),
    onSuccess: (updatedSession, { id }) => {
      // Update the session in all relevant caches
      queryClient.setQueryData(sessionsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, session: updatedSession };
      });

      // Update in the main sessions list
      queryClient.setQueryData(sessionsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sessions: old.sessions.map((session: Tables<'sessions'>) =>
            session.id === id ? updatedSession : session
          ),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sessionsApi.deleteSession,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: sessionsKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(sessionsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sessions: old.sessions.filter((session: Tables<'sessions'>) => session.id !== deletedId),
          sessionStudents: Object.fromEntries(
            Object.entries(old.sessionStudents).filter(([id]) => id !== deletedId)
          ),
          sessionStaff: Object.fromEntries(
            Object.entries(old.sessionStaff).filter(([id]) => id !== deletedId)
          ),
        };
      });

      // Invalidate all session queries
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    },
  });
}

export function useAddStudentToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: string; studentId: string }) =>
      sessionsApi.addStudentToSession(sessionId, studentId),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session details to refetch with new student
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.withDetails() });
      
      // Also invalidate student queries since they show session information
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useRemoveStudentFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: string; studentId: string }) =>
      sessionsApi.removeStudentFromSession(sessionId, studentId),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session details to refetch without the student
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.withDetails() });
      
      // Also invalidate student queries since they show session information
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useAssignStaffToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, staffId, type }: { sessionId: string; staffId: string; type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' }) =>
      sessionsApi.assignStaffToSession(sessionId, staffId, type),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session details to refetch with new staff
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.withDetails() });
      
      // Also invalidate staff queries since they show session information
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useRemoveStaffFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, staffId }: { sessionId: string; staffId: string }) =>
      sessionsApi.removeStaffFromSession(sessionId, staffId),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session details to refetch without the staff
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.withDetails() });
      
      // Also invalidate staff queries since they show session information
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}
