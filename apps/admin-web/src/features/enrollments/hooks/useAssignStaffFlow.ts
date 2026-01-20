import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { AssignStaffContext } from '../types/enrollment';

interface UseAssignStaffFlowProps {
  isOpen: boolean;
  context: AssignStaffContext;
  onAssign: (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => Promise<void>;
  currentStaffId: string;
  staff?: Tables<'staff'>;
  classData?: Tables<'classes'>;
  selectedStaffIds: string[];
  selectedClassIds: string[];
  assignmentDate: string;
  onClose: () => void;
}

export function useAssignStaffFlow({
  isOpen: _isOpen,
  context,
  onAssign,
  currentStaffId,
  staff,
  classData,
  selectedStaffIds,
  selectedClassIds,
  assignmentDate,
  onClose,
}: UseAssignStaffFlowProps) {
  const [isAssigning, setIsAssigning] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (context === 'staff' && staff) {
      // Assign staff to all selected classes
      if (selectedClassIds.length === 0) return;
      
      setIsAssigning(true);
      try {
        const assignedAt = getMidnightAdelaide(new Date(assignmentDate));
        await Promise.all(
          selectedClassIds.map(classId =>
            onAssign({
              staffId: staff.id,
              classId,
              assignedAt,
              currentStaffId,
            })
          )
        );
        onClose();
      } catch (error) {
        console.error('Error assigning staff:', error);
        throw error;
      } finally {
        setIsAssigning(false);
      }
    } else if (context === 'class' && classData) {
      // Assign all selected staff to class
      if (selectedStaffIds.length === 0) return;
      
      setIsAssigning(true);
      try {
        const assignedAt = getMidnightAdelaide(new Date(assignmentDate));
        await Promise.all(
          selectedStaffIds.map(staffId =>
            onAssign({
              staffId,
              classId: classData.id,
              assignedAt,
              currentStaffId,
            })
          )
        );
        onClose();
      } catch (error) {
        console.error('Error assigning staff:', error);
        throw error;
      } finally {
        setIsAssigning(false);
      }
    }
  }, [
    context,
    staff,
    classData,
    selectedStaffIds,
    selectedClassIds,
    assignmentDate,
    onAssign,
    currentStaffId,
    onClose,
  ]);

  return {
    isAssigning,
    handleConfirm,
  };
}

