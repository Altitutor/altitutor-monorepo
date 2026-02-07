import { useState, useCallback, useEffect } from 'react';
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
  classSubject: _classSubject,
  onEnroll,
  currentStaffId,
  student,
  classData,
  selectedStudentId,
  selectedClassId,
  enrollmentDate,
  onClose: _onClose,
}: UseEnrollmentFlowProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

  // Reset enrollment success when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEnrollmentSuccess(false);
    }
  }, [isOpen]);

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
      setEnrollmentSuccess(true);
    } catch (error) {
      console.error('Error enrolling student:', error);
      setEnrollmentSuccess(false);
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
  ]);

  return {
    isEnrolling,
    handleConfirm,
    enrollmentSuccess,
  };
}

