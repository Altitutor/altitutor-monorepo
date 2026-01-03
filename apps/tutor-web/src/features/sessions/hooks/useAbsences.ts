import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { absencesApi } from '../api';
import type {
  AbsenceOperation,
  LogAbsencesResponse,
  GetRescheduleSessionsParams,
  RescheduleSession,
  StudentSession,
} from '../types/absence';

/**
 * Hook to get a student's future sessions
 */
export function useStudentFutureSessions(studentId: string | null, weeksAhead: number = 8) {
  return useQuery<StudentSession[], Error>({
    queryKey: ['studentFutureSessions', studentId, weeksAhead],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID is required');
      return absencesApi.getStudentFutureSessions(studentId, weeksAhead);
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

        // Invalidate sessions queries
        queryClient.invalidateQueries({
          queryKey: ['sessions'],
        });

        // Invalidate sessions with details
        queryClient.invalidateQueries({
          queryKey: ['sessionsWithDetails'],
        });
      }
    },
    onError: (error) => {
      console.error('Error logging absences:', error);
    },
  });
}

