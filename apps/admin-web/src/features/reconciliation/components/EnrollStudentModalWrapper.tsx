'use client';

import { useStudentWithSubjects } from '@/features/students/hooks/useStudentsQuery';
import { useStudentClasses } from '@/features/students/hooks/useStudentClasses';
import { EnrollStudentModal } from '@/features/enrollments';
import { classesApi } from '@/features/classes/api';

interface EnrollStudentModalWrapperProps {
  isOpen: boolean;
  studentId: string;
  subjectId: string | null;
  currentStaffId: string;
  onClose: () => void;
  onEnroll: (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => Promise<void>;
}

/**
 * Wrapper component to handle student data fetching for EnrollStudentModal
 */
export function EnrollStudentModalWrapper({
  isOpen,
  studentId,
  subjectId,
  currentStaffId,
  onClose,
  onEnroll,
}: EnrollStudentModalWrapperProps) {
  const { data: studentWithSubjects, isLoading: isLoadingStudent } = useStudentWithSubjects(studentId);
  const { data: studentClasses = [] } = useStudentClasses(studentId);

  const student = studentWithSubjects?.student || null;
  const studentSubjects = studentWithSubjects?.subjects || [];
  const enrolledClassIds = studentClasses.map((c) => c.class.id);

  // Fetch classes for the subject using API function
  const fetchClassesForSubject = async (subjId: string) => {
    return classesApi.fetchClassesForSubject(subjId);
  };

  // Don't render modal until data is loaded
  if (!isOpen || isLoadingStudent || !student) {
    return null;
  }

  return (
    <EnrollStudentModal
      isOpen={isOpen}
      onClose={onClose}
      context="student"
      student={student}
      studentSubjects={studentSubjects}
      enrolledClassIds={enrolledClassIds}
      onFetchClasses={subjectId ? () => fetchClassesForSubject(subjectId) : undefined}
      subjectId={subjectId || undefined}
      onEnroll={onEnroll}
      currentStaffId={currentStaffId}
    />
  );
}
