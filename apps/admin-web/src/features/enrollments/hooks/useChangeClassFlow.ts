import { useState, useCallback, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseChangeClassFlowProps {
  isOpen: boolean;
  student: Tables<'students'>;
  oldClass: Tables<'classes'>;
  selectedNewClassId: string | null;
  lastOldClassDate: string;
  firstNewClassDate: string;
  onChange: (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    lastOldClassDate: string;
    firstNewClassDate: string;
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
  lastOldClassDate,
  firstNewClassDate,
  onChange,
  currentStaffId,
  onClose: _onClose,
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
    if (!selectedNewClassId || !lastOldClassDate || !firstNewClassDate || lastOldClassDate >= firstNewClassDate) return;
    
    setIsChanging(true);
    try {
      await onChange({
        studentId: student.id,
        oldClassId: oldClass.id,
        newClassId: selectedNewClassId,
        lastOldClassDate,
        firstNewClassDate,
        staffId: currentStaffId,
      });
      setChangeSuccess(true);
    } catch (error) {
      console.error('Error changing class:', error);
      setChangeSuccess(false);
    } finally {
      setIsChanging(false);
    }
  }, [student, oldClass, selectedNewClassId, lastOldClassDate, firstNewClassDate, onChange, currentStaffId]);

  return {
    isChanging,
    handleConfirm,
    changeSuccess,
  };
}

