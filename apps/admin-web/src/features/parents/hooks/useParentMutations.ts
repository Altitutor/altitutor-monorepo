import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { studentsApi } from '@/features/students/api/students';
import { parentsKeys } from './useParentsQuery';
import type { ParentDetailsFormData } from '@/features/students/components/tabs/ParentDetailsTab';

interface UseParentMutationsProps {
  parentId: string;
  onSuccess?: () => void;
}

interface UseParentMutationsReturn {
  // Loading states
  isUpdatingDetails: boolean;
  
  // Mutations
  updateDetails: (data: ParentDetailsFormData, studentChanges: { toAdd: string[]; toRemove: string[] }) => Promise<void>;
}

/**
 * Hook for managing all parent mutations
 * Handles update and student assignments
 */
export function useParentMutations({
  parentId,
  onSuccess,
}: UseParentMutationsProps): UseParentMutationsReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  const updateDetails = async (
    data: ParentDetailsFormData,
    studentChanges: { toAdd: string[]; toRemove: string[] }
  ) => {
    try {
      setIsUpdatingDetails(true);
      
      // Update parent information
      await studentsApi.updateParent(parentId, {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
      });
      
      // Apply student changes
      for (const studentId of studentChanges.toAdd) {
        await studentsApi.assignStudentToParent(parentId, studentId);
      }
      for (const studentId of studentChanges.toRemove) {
        await studentsApi.removeStudentFromParent(parentId, studentId);
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: parentsKeys.detail(parentId) });
      queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
      
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

  return {
    isUpdatingDetails,
    updateDetails,
  };
}
