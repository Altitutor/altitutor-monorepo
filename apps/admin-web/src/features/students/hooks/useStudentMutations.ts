import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import {
  useUpdateStudent,
  useDeleteStudent,
  useAssignSubjectToStudent,
  useRemoveSubjectFromStudent,
  useAssignParentToStudent,
  useRemoveParentFromStudent,
  studentsKeys,
} from './useStudentsQuery';
import { mapDetailsFormToStudentUpdate } from '../mappers/studentMappers';
import type { DetailsFormData } from '../components/tabs';

interface UseStudentMutationsProps {
  studentId: string;
  onSuccess?: () => void;
}

interface UseStudentMutationsReturn {
  // Loading states
  isUpdatingDetails: boolean;
  isDeleting: boolean;
  
  // Mutations
  updateDetails: (data: DetailsFormData, subjectChanges: { toAdd: string[]; toRemove: string[] }, parentChanges: { toAdd: string[]; toRemove: string[] }) => Promise<void>;
  deleteStudent: () => Promise<void>;
}

/**
 * Hook for managing all student mutations
 * Handles update, delete, and subject/parent assignments
 */
export function useStudentMutations({
  studentId,
  onSuccess,
}: UseStudentMutationsProps): UseStudentMutationsReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();
  const assignSubjectMutation = useAssignSubjectToStudent();
  const removeSubjectMutation = useRemoveSubjectFromStudent();
  const assignParentMutation = useAssignParentToStudent();
  const removeParentMutation = useRemoveParentFromStudent();

  const updateDetails = async (
    data: DetailsFormData,
    subjectChanges: { toAdd: string[]; toRemove: string[] },
    parentChanges: { toAdd: string[]; toRemove: string[] }
  ) => {
    try {
      setIsUpdatingDetails(true);
      
      // Update student basic info
      const payload = mapDetailsFormToStudentUpdate(data);
      await updateStudentMutation.mutateAsync({ id: studentId, data: payload });
      
      // Apply subject changes
      for (const subjectId of subjectChanges.toAdd) {
        await assignSubjectMutation.mutateAsync({ studentId, subjectId });
      }
      for (const subjectId of subjectChanges.toRemove) {
        await removeSubjectMutation.mutateAsync({ studentId, subjectId });
      }
      
      // Apply parent changes
      for (const parentId of parentChanges.toAdd) {
        await assignParentMutation.mutateAsync({ studentId, parentId });
      }
      for (const parentId of parentChanges.toRemove) {
        await removeParentMutation.mutateAsync({ studentId, parentId });
      }
      
      // Invalidate student details query
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(studentId) });
      
      toast({
        title: 'Success',
        description: 'Details updated successfully.',
      });
      
      onSuccess?.();
    } catch (error: unknown) {
      console.error('Failed to update details:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to update details. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const deleteStudent = async () => {
    try {
      setIsDeleting(true);
      await deleteStudentMutation.mutateAsync(studentId);
      
      toast({
        title: 'Success',
        description: 'Student deleted successfully.',
      });
      
      onSuccess?.();
    } catch (error: unknown) {
      console.error('Failed to delete student:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to delete student. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isUpdatingDetails,
    isDeleting,
    updateDetails,
    deleteStudent,
  };
}
