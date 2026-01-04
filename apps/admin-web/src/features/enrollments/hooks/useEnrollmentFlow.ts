import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { EnrollmentContext } from '../types/enrollment';

interface UseEnrollmentFlowProps {
  isOpen: boolean;
  context: EnrollmentContext;
  classSubject?: Tables<'subjects'>;
  onEnroll: (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => Promise<void>;
  currentStaffId: string;
  student?: Tables<'students'>;
  classData?: Tables<'classes'>;
  selectedStudentId: string | null;
  selectedClassId: string | null;
  enrollmentDate: string;
  onClose: () => void;
}

export function useEnrollmentFlow({
  isOpen,
  context,
  classSubject,
  onEnroll,
  currentStaffId,
  student,
  classData,
  selectedStudentId,
  selectedClassId,
  enrollmentDate,
  onClose,
}: UseEnrollmentFlowProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleConfirm = useCallback(async () => {
    const finalStudentId = context === 'student' ? student!.id : selectedStudentId;
    const finalClassId = context === 'class' ? classData!.id : selectedClassId;
    
    if (!finalStudentId || !finalClassId) return;
    
    setIsEnrolling(true);
    try {
      await onEnroll({
        studentId: finalStudentId,
        classId: finalClassId,
        enrolledAt: getMidnightAdelaide(new Date(enrollmentDate)),
        staffId: currentStaffId,
      });
      onClose();
    } catch (error) {
      console.error('Error enrolling student:', error);
    } finally {
      setIsEnrolling(false);
    }
  }, [
    context,
    student,
    selectedStudentId,
    classData,
    selectedClassId,
    enrollmentDate,
    onEnroll,
    currentStaffId,
    onClose,
  ]);

  return {
    isEnrolling,
    handleConfirm,
  };
}

