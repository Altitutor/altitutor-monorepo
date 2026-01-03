import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffAbsencesApi } from '../api';
import { sessionsKeys } from './useSessionsQuery';
import type {
  StaffAbsenceOperation,
  LogStaffAbsencesResponse,
  GetReplacementStaffParams,
  ReplacementStaff,
  StaffSession,
} from '../types/staff-absence';

/**
 * Hook to get a staff member's future sessions
 */
export function useStaffFutureSessions(staffId: string | null, weeksAhead: number = 8) {
  return useQuery<StaffSession[], Error>({
    queryKey: ['staffFutureSessions', staffId, weeksAhead],
    queryFn: () => {
      if (!staffId) throw new Error('Staff ID is required');
      return staffAbsencesApi.getStaffFutureSessions(staffId, weeksAhead);
    },
    enabled: !!staffId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get available replacement staff
 */
export function useAvailableReplacementStaff(params: GetReplacementStaffParams | null) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  // Sort excludeStaffIds array for consistent query key
  const excludeStaffIdsKey = params?.excludeStaffIds ? [...params.excludeStaffIds].sort().join(',') : null;
  const queryKey = [
    'availableReplacementStaff',
    params?.sessionId,
    params?.subjectId,
    excludeStaffIdsKey,
  ];
  
  return useQuery<ReplacementStaff[], Error>({
    queryKey: queryKey,
    queryFn: () => {
      if (!params) throw new Error('Parameters are required');
      return staffAbsencesApi.getAvailableReplacementStaff(params);
    },
    enabled: !!params && !!params.sessionId && !!params.subjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to log staff absences with optimistic updates
 */
export function useLogStaffAbsences() {
  const queryClient = useQueryClient();

  return useMutation<LogStaffAbsencesResponse, Error, { operations: StaffAbsenceOperation[]; staffId: string }>({
    mutationFn: ({ operations, staffId }) => staffAbsencesApi.logStaffAbsences(operations, staffId),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries on success
      if (data.success) {
        // Invalidate staff future sessions for all affected staff
        const affectedStaffIds = new Set(variables.operations.map(op => op.staff_id));
        affectedStaffIds.forEach(staffId => {
          queryClient.invalidateQueries({
            queryKey: ['staffFutureSessions', staffId],
          });
        });

        // Invalidate sessions queries using proper key constants
        queryClient.invalidateQueries({
          queryKey: sessionsKeys.all,
        });
      }
    },
    onError: (error) => {
      console.error('Error logging staff absences:', error);
    },
  });
}

