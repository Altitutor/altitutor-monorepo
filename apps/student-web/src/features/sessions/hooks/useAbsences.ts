import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { absencesApi } from '../api/absences';
import type {
  AbsenceOperation,
  LogAbsencesResponse,
  GetRescheduleSessionsParams,
  RescheduleSession,
  StudentSession,
} from '../types/absence';

/**
 * Hook to get current student's future sessions
 */
export function useStudentFutureSessions(weeksAhead: number = 8) {
  return useQuery<StudentSession[], Error>({
    queryKey: ['studentFutureSessions', weeksAhead],
    queryFn: () => absencesApi.getStudentFutureSessions(weeksAhead),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get available reschedule sessions
 */
export function useAvailableRescheduleSessions(params: GetRescheduleSessionsParams | null) {
  // Use individual values in query key instead of object to ensure stability
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
    // Don't treat empty arrays as errors - 0 available sessions is valid
    retry: (failureCount, error) => {
      // Don't retry if it's a "0 rows" error (which is valid)
      if (error instanceof Error && error.message.includes('0 rows')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to log student absences with optimistic updates
 */
export function useLogAbsences() {
  const queryClient = useQueryClient();

  return useMutation<LogAbsencesResponse, Error, { operations: AbsenceOperation[] }>({
    mutationFn: ({ operations }) => absencesApi.logAbsences(operations),
    onSuccess: (data) => {
      // Invalidate relevant queries on success
      if (data.success) {
        // Invalidate student future sessions
        queryClient.invalidateQueries({
          queryKey: ['studentFutureSessions'],
        });

        // Invalidate student sessions queries
        queryClient.invalidateQueries({
          queryKey: ['student', 'sessions'],
        });
      }
    },
    onError: (error) => {
      console.error('Error logging absences:', error);
    },
  });
}
