import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/features/students/api/students';
import { useSessionForLogging, type SessionForLogging } from './useSessionForLogging';
import type { Tables } from '@altitutor/shared';

export type StudentAttendanceItem = {
  studentId: string;
  attended: boolean;
};

export interface UseStudentAttendanceProps {
  sessionId: string;
  studentAttendance: StudentAttendanceItem[];
  onUpdate: (studentAttendance: StudentAttendanceItem[]) => void;
}

export interface UseStudentAttendanceReturn {
  sessionData: SessionForLogging | undefined;
  sessionStudents: Array<{
    student_id: string;
    student: Tables<'students'>;
    planned_absence: boolean;
    is_extra: boolean;
  }>;
  allStudents: Tables<'students'>[];
  filteredStudents: Tables<'students'>[];
  isLoading: boolean;

  showSearch: boolean;
  searchTerm: string;
  setShowSearch: (show: boolean) => void;
  setSearchTerm: (term: string) => void;

  handleAttendanceChange: (studentId: string, attended: boolean) => void;
  handleAddStudent: (studentId: string) => void;
  handleRemoveStudent: (studentId: string) => void;
  getStudentAttendance: (studentId: string) => StudentAttendanceItem | undefined;
  isStudentAlreadyAdded: (studentId: string) => boolean;
}

/**
 * Hook for managing student attendance in tutor log step 3
 */
export function useStudentAttendance({
  sessionId,
  studentAttendance,
  onUpdate,
}: UseStudentAttendanceProps): UseStudentAttendanceReturn {
  const { data: sessionData, isLoading: isLoadingSession } = useSessionForLogging(sessionId);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const hasInitialized = useRef(false);

  const { data: allStudentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', 'all', 'forSearch'],
    queryFn: async () => {
      const result = await studentsApi.list({
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 10000,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return result.students;
    },
    staleTime: 1000 * 60 * 5,
  });

  const allStudents = useMemo(() => allStudentsData || [], [allStudentsData]);
  const isLoading = isLoadingSession || isLoadingStudents;

  const sessionStudents = useMemo(() => {
    return (
      sessionData?.students.map((student) => ({
        student_id: student.id,
        student: student as Tables<'students'>,
        planned_absence: student.planned_absence ?? false,
        is_extra: student.is_extra ?? false,
      })) || []
    );
  }, [sessionData?.students]);

  useEffect(() => {
    if (!hasInitialized.current && studentAttendance.length === 0 && sessionStudents.length > 0 && !isLoading) {
      hasInitialized.current = true;
      const initialAttendance = sessionStudents.map((ss) => ({
        studentId: ss.student_id,
        attended: !ss.planned_absence,
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStudents.length, isLoading]);

  const handleAttendanceChange = (studentId: string, attended: boolean) => {
    const updated = studentAttendance.map((sa) =>
      sa.studentId === studentId ? { ...sa, attended } : sa
    );

    if (!studentAttendance.find((sa) => sa.studentId === studentId)) {
      updated.push({ studentId, attended });
    }

    onUpdate(updated);
  };

  const handleAddStudent = (studentId: string) => {
    handleAttendanceChange(studentId, true);
    setSearchTerm('');
    setShowSearch(false);
  };

  const handleRemoveStudent = (studentId: string) => {
    onUpdate(studentAttendance.filter((sa) => sa.studentId !== studentId));
  };

  const getStudentAttendance = (studentId: string) => {
    return studentAttendance.find((sa) => sa.studentId === studentId);
  };

  const isStudentAlreadyAdded = useCallback(
    (studentId: string) => {
      return sessionData?.students.some((s) => s.id === studentId) || studentAttendance.some((a) => a.studentId === studentId);
    },
    [sessionData?.students, studentAttendance]
  );

  const filteredStudents = useMemo(() => {
    return allStudents.filter(
      (student) =>
        !isStudentAlreadyAdded(student.id) &&
        (searchTerm === '' ||
          `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allStudents, searchTerm, isStudentAlreadyAdded]);

  return {
    sessionData,
    sessionStudents,
    allStudents,
    filteredStudents,
    isLoading,

    showSearch,
    searchTerm,
    setShowSearch,
    setSearchTerm,

    handleAttendanceChange,
    handleAddStudent,
    handleRemoveStudent,
    getStudentAttendance,
    isStudentAlreadyAdded,
  };
}
