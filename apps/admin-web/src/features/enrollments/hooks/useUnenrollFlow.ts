import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';
import type { Tables } from '@altitutor/shared';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import {
  invalidateStudentClassSurfaces,
  invalidateStudentSessionSurfaces,
} from '@/shared/lib/query-invalidation';

interface UseUnenrollFlowProps {
  isOpen: boolean;
  student: Tables<'students'>;
  classData: Tables<'classes'>;
  unenrollmentDate: string;
  reason: JSONContent | undefined;
  onUnenroll: (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: JSONContent;
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
  onClose: _onClose,
}: UseUnenrollFlowProps) {
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [unenrollmentSuccess, setUnenrollmentSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Reset unenrollment success when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUnenrollmentSuccess(false);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (isTiptapContentEmpty(reason)) return;
    setIsUnenrolling(true);
    try {
      await onUnenroll({
        studentId: student.id,
        classId: classData.id,
        unenrolledAt: getMidnightAdelaide(new Date(unenrollmentDate)),
        reason: reason as JSONContent,
        staffId: currentStaffId,
      });
      
      await Promise.all([
        invalidateStudentClassSurfaces(queryClient, student.id),
        invalidateStudentSessionSurfaces(queryClient, student.id),
      ]);
      
      setUnenrollmentSuccess(true);
    } catch (error) {
      console.error('Error unenrolling student:', error);
      setUnenrollmentSuccess(false);
    } finally {
      setIsUnenrolling(false);
    }
  }, [student, classData, unenrollmentDate, reason, onUnenroll, currentStaffId, queryClient]);

  return {
    isUnenrolling,
    handleConfirm,
    unenrollmentSuccess,
  };
}
