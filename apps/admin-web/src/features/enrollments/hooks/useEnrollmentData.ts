import { useState, useEffect } from 'react';
import type { ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, StudentWithEnrollmentInfo } from '../types/enrollment';

interface UseEnrollmentDataProps {
  isOpen: boolean;
  step: 1 | 2 | 3;
  context: EnrollmentContext;
  onFetchStudents?: () => Promise<StudentWithEnrollmentInfo[]>;
  onFetchClasses?: () => Promise<ClassWithExpandedSubject[]>;
}

export function useEnrollmentData({
  isOpen,
  step,
  context,
  onFetchStudents,
  onFetchClasses,
}: UseEnrollmentDataProps) {
  const [students, setStudents] = useState<StudentWithEnrollmentInfo[]>([]);
  const [classes, setClasses] = useState<ClassWithExpandedSubject[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (isOpen && step === 1) {
      if (context === 'class' && onFetchStudents) {
        setIsFetching(true);
        onFetchStudents()
          .then(setStudents)
          .finally(() => setIsFetching(false));
      } else if (context === 'student' && onFetchClasses) {
        setIsFetching(true);
        onFetchClasses()
          .then(setClasses)
          .finally(() => setIsFetching(false));
      }
    }
  }, [isOpen, step, context, onFetchStudents, onFetchClasses]);

  return {
    students,
    classes,
    isFetching,
  };
}

