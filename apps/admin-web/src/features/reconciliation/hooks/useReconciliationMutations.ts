import { useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/features/classes/api';
import { reconciliationKeys } from '../api/queryKeys';
import { useToast } from '@altitutor/ui';

/**
 * Hook for assigning staff to a class with automatic query invalidation
 */
export function useAssignStaffMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      staffId: string;
      classId: string;
      assignedAt: Date;
      currentStaffId: string;
    }) => {
      return classesApi.assignStaff(params.classId, params.staffId, params.currentStaffId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
      toast({
        title: 'Success',
        description: 'Staff assigned successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign staff',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook for enrolling a student in a class with automatic query invalidation
 */
export function useEnrollStudentMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      studentId: string;
      classId: string;
      enrolledAt: Date;
      staffId: string;
    }) => {
      return classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
      toast({
        title: 'Success',
        description: 'Student enrolled successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to enroll student',
        variant: 'destructive',
      });
    },
  });
}
