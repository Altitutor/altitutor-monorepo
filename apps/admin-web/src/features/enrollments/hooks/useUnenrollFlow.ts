import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';

interface UseUnenrollFlowProps {
  isOpen: boolean;
  student: Tables<'students'>;
  classData: Tables<'classes'>;
  unenrollmentDate: string;
  reason: string;
  onUnenroll: (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: string;
    staffId: string;
  }) => Promise<void>;
  currentStaffId: string;
  onClose: () => void;
}

export function useUnenrollFlow({
  isOpen,
  student,
  classData,
  unenrollmentDate,
  reason,
  onUnenroll,
  currentStaffId,
  onClose,
}: UseUnenrollFlowProps) {
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsUnenrolling(true);
    try {
      await onUnenroll({
        studentId: student.id,
        classId: classData.id,
        unenrolledAt: getMidnightAdelaide(new Date(unenrollmentDate)),
        reason,
        staffId: currentStaffId,
      });
      onClose();
    } catch (error) {
      console.error('Error unenrolling student:', error);
    } finally {
      setIsUnenrolling(false);
    }
  }, [student, classData, unenrollmentDate, reason, onUnenroll, currentStaffId, onClose]);

  return {
    isUnenrolling,
    handleConfirm,
  };
}

