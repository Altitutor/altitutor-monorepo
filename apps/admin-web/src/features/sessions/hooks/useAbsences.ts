import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { absencesApi } from '../api';
import { sessionsKeys } from './useSessionsQuery';
import type {
  AbsenceOperation,
  LogAbsencesResponse,
  UndoAbsenceOperation,
  UndoAbsencesResponse,
  GetRescheduleSessionsParams,
  RescheduleSession,
  StudentSession,
} from '../types/absence';

/**
 * Hook to get a student's future sessions
 * @param weeksAhead - Number of weeks ahead to fetch, or null to fetch all future sessions
 */
export function useStudentFutureSessions(
  studentId: string | null, 
  weeksAhead: number | null = 8,
  allowPastSessions: boolean = false,
  weeksBack: number = 4
) {
  return useQuery<StudentSession[], Error>({
    queryKey: ['studentFutureSessions', studentId, weeksAhead, allowPastSessions, weeksBack],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID is required');
      return absencesApi.getStudentFutureSessions(studentId, weeksAhead, allowPastSessions, weeksBack);
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get available reschedule sessions
 */
export function useAvailableRescheduleSessions(params: GetRescheduleSessionsParams | null) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  const queryKey = [
    'availableRescheduleSessions',
    params?.originalSessionId,
    params?.studentId,
    params?.dateRangeDays,
  ];
  
  return useQuery<RescheduleSession[], Error>({
    queryKey: queryKey,
    queryFn: () => {
      if (!params) throw new Error('Parameters are required');
      return absencesApi.getAvailableRescheduleSessions(params);
    },
    enabled: !!params && !!params.originalSessionId && !!params.studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to log student absences with optimistic updates
 */
export function useLogAbsences() {
  const queryClient = useQueryClient();

  return useMutation<LogAbsencesResponse, Error, { operations: AbsenceOperation[]; staffId: string }>({
    mutationFn: ({ operations, staffId }) => absencesApi.logAbsences(operations, staffId),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries on success
      if (data.success) {
        // Invalidate student future sessions for all affected students
        const affectedStudentIds = new Set(variables.operations.map(op => op.student_id));
        affectedStudentIds.forEach(studentId => {
          queryClient.invalidateQueries({
            queryKey: ['studentFutureSessions', studentId],
          });
        });

        // Invalidate sessions queries using proper key constants
        queryClient.invalidateQueries({
          queryKey: sessionsKeys.all,
        });
      }
    },
    onError: (error) => {
      console.error('Error logging absences:', error);
    },
  });
}

/**
 * Hook to undo student absences
 */
export function useUndoAbsences() {
  const queryClient = useQueryClient();

  return useMutation<UndoAbsencesResponse, Error, { operations: UndoAbsenceOperation[]; staffId: string }>({
    mutationFn: ({ operations, staffId }) => absencesApi.undoAbsences(operations, staffId),
    onSuccess: (data, variables) => {
      if (data.success) {
        const affectedStudentIds = new Set(variables.operations.map(op => op.student_id));
        affectedStudentIds.forEach(studentId => {
          queryClient.invalidateQueries({
            queryKey: ['studentFutureSessions', studentId],
          });
        });

        queryClient.invalidateQueries({
          queryKey: sessionsKeys.all,
        });
      }
    },
    onError: (error) => {
      console.error('Error undoing absences:', error);
    },
  });
}
