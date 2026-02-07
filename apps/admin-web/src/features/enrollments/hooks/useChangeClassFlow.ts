import { useState, useCallback, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';

interface UseChangeClassFlowProps {
  isOpen: boolean;
  student: Tables<'students'>;
  oldClass: Tables<'classes'>;
  selectedNewClassId: string | null;
  changeoverDate: string;
  onChange: (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }) => Promise<void>;
  currentStaffId: string;
  onClose: () => void;
}

export function useChangeClassFlow({
  isOpen,
  student,
  oldClass,
  selectedNewClassId,
  changeoverDate,
  onChange,
  currentStaffId,
  onClose,
}: UseChangeClassFlowProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);

  // Reset change success when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChangeSuccess(false);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (!selectedNewClassId) return;
    
    setIsChanging(true);
    try {
      await onChange({
        studentId: student.id,
        oldClassId: oldClass.id,
        newClassId: selectedNewClassId,
        changeoverDate: getMidnightAdelaide(new Date(changeoverDate)),
        staffId: currentStaffId,
      });
      setChangeSuccess(true);
    } catch (error) {
      console.error('Error changing class:', error);
      setChangeSuccess(false);
    } finally {
      setIsChanging(false);
    }
  }, [student, oldClass, selectedNewClassId, changeoverDate, onChange, currentStaffId]);

  return {
    isChanging,
    handleConfirm,
    changeSuccess,
  };
}

