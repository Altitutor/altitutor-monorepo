import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import {
  useUpdateStaff,
  useDeleteStaff,
  useAssignSubjectToStaff,
  useRemoveSubjectFromStaff,
  staffKeys,
} from './useStaffQuery';
import type { StaffDetailsFormData } from '../components/modal/tabs';

interface UseStaffMutationsProps {
  staffId: string;
  onSuccess?: () => void;
}

interface UseStaffMutationsReturn {
  // Loading states
  isUpdatingDetails: boolean;
  isDeleting: boolean;
  
  // Mutations
  updateDetails: (data: StaffDetailsFormData, subjectChanges: { toAdd: string[]; toRemove: string[] }) => Promise<void>;
  deleteStaff: () => Promise<void>;
}

/**
 * Hook for managing all staff mutations
 * Handles update, delete, and subject assignments
 */
export function useStaffMutations({
  staffId,
  onSuccess,
}: UseStaffMutationsProps): UseStaffMutationsReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();
  const assignSubjectMutation = useAssignSubjectToStaff();
  const removeSubjectMutation = useRemoveSubjectFromStaff();

  const updateDetails = async (
    data: StaffDetailsFormData,
    subjectChanges: { toAdd: string[]; toRemove: string[] }
  ) => {
    try {
      setIsUpdatingDetails(true);
      
      // Map form data to staff update
      const updateData = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || undefined,
        phone_number: data.phoneNumber || null,
        role: data.role,
        status: data.status,
        office_key_number: data.officeKeyNumber,
        has_parking_remote: data.hasParkingRemote,
        availability_monday: data.availability_monday,
        availability_tuesday: data.availability_tuesday,
        availability_wednesday: data.availability_wednesday,
        availability_thursday: data.availability_thursday,
        availability_friday: data.availability_friday,
        availability_saturday_am: data.availability_saturday_am,
        availability_saturday_pm: data.availability_saturday_pm,
        availability_sunday_am: data.availability_sunday_am,
        availability_sunday_pm: data.availability_sunday_pm,
        drafting_availability: data.drafting_availability,
        trial_session_availability: data.trial_session_availability,
        subsidy_interview_availability: data.subsidy_interview_availability,
      };
      
      // Update staff basic info
      await updateStaffMutation.mutateAsync({ id: staffId, data: updateData });
      
      // Apply subject changes
      for (const subjectId of subjectChanges.toAdd) {
        await assignSubjectMutation.mutateAsync({ staffId, subjectId });
      }
      for (const subjectId of subjectChanges.toRemove) {
        await removeSubjectMutation.mutateAsync({ staffId, subjectId });
      }
      
      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
      await queryClient.invalidateQueries({ queryKey: staffKeys.minimal({}) });
      
      toast({
        title: 'Staff updated',
        description: 'Staff member has been updated successfully.',
      });
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update staff:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'There was an error updating the staff member. Please try again.';
      toast({
        title: 'Update failed',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const deleteStaff = async () => {
    try {
      setIsDeleting(true);
      await deleteStaffMutation.mutateAsync(staffId);
      
      toast({
        title: 'Staff deleted',
        description: 'Staff member has been deleted successfully.',
      });
      
      onSuccess?.();
    } catch (error: unknown) {
      console.error('Failed to delete staff:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'There was an error deleting the staff member. Please try again.';
      toast({
        title: 'Delete failed',
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
    deleteStaff,
  };
}
