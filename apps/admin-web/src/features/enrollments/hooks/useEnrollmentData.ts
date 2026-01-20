import { useQuery } from '@tanstack/react-query';
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
  // Fetch students when enrolling a student to a class
  const shouldFetchStudents = isOpen && step === 1 && context === 'class' && !!onFetchStudents;
  const studentsQuery = useQuery({
    queryKey: ['enrollment-data', 'students', context, step],
    queryFn: async () => {
      if (!onFetchStudents) return [];
      return onFetchStudents();
    },
    enabled: shouldFetchStudents,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch classes when enrolling a class to a student
  const shouldFetchClasses = isOpen && step === 1 && context === 'student' && !!onFetchClasses;
  const classesQuery = useQuery({
    queryKey: ['enrollment-data', 'classes', context, step],
    queryFn: async () => {
      if (!onFetchClasses) return [];
      return onFetchClasses();
    },
    enabled: shouldFetchClasses,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    students: studentsQuery.data || [],
    classes: classesQuery.data || [],
    isFetching: studentsQuery.isLoading || classesQuery.isLoading,
  };
}

