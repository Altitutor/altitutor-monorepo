import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/features/students/api/students';
import { useSessionForLogging } from './useSessionForLogging';
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
  // Data
  sessionStudents: Array<{
    student_id: string;
    student: Tables<'students'>;
    planned_absence: boolean;
    is_extra: boolean;
  }>;
  allStudents: Tables<'students'>[];
  filteredStudents: Tables<'students'>[];
  isLoading: boolean;
  
  // UI state
  additionalStudents: string[];
  showSearch: boolean;
  searchTerm: string;
  setShowSearch: (show: boolean) => void;
  setSearchTerm: (term: string) => void;
  
  // Actions
  handleAttendanceChange: (studentId: string, attended: boolean) => void;
  handleAddStudent: (studentId: string) => void;
  handleRemoveStudent: (studentId: string) => void;
  getStudentAttendance: (studentId: string) => StudentAttendanceItem | undefined;
  isStudentAlreadyAdded: (studentId: string) => boolean;
}

/**
 * Hook for managing student attendance in tutor log step 3
 * Handles session students, additional students, search, and attendance state
 */
export function useStudentAttendance({
  sessionId,
  studentAttendance,
  onUpdate,
}: UseStudentAttendanceProps): UseStudentAttendanceReturn {
  const { data: sessionData, isLoading: isLoadingSession } = useSessionForLogging(sessionId);
  const [additionalStudents, setAdditionalStudents] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const hasInitialized = useRef(false);

  // Fetch all students for search (with pagination for large datasets)
  const { data: allStudentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', 'all', 'forSearch'],
    queryFn: async () => {
      const result = await studentsApi.list({
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 10000, // Large limit to get all students
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return result.students;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const allStudents = useMemo(() => allStudentsData || [], [allStudentsData]);
  const isLoading = isLoadingSession || isLoadingStudents;

  // Transform session students data
  const sessionStudents = useMemo(() => {
    return sessionData?.students.map((student) => ({
      student_id: student.id,
      student: student,
      planned_absence: student.planned_absence ?? false,
      is_extra: student.is_extra ?? false,
    })) || [];
  }, [sessionData?.students]);

  // Initialize form data if empty (separate effect to avoid setState during render)
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
  }, [sessionStudents.length, isLoading]); // Only depend on sessionStudents.length and isLoading

  // Initialize additionalStudents from existing studentAttendance when editing.
  // If sessionStudents is empty, ALL students from studentAttendance are "additional".
  // If sessionStudents has data, only students NOT in session are "additional".
  const hasInitializedAdditional = useRef(false);
  useEffect(() => {
    if (!isLoading && studentAttendance.length > 0 && !hasInitializedAdditional.current) {
      const sessionStudentIds = new Set(sessionStudents.map((ss) => ss.student_id));
      const additionalStudentIds = studentAttendance
        .map((sa) => sa.studentId)
        .filter((id) => !sessionStudentIds.has(id));

      if (additionalStudentIds.length > 0) {
        hasInitializedAdditional.current = true;
        setAdditionalStudents(additionalStudentIds);
      }
    }
  }, [isLoading, sessionStudents, studentAttendance]);

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
    if (!additionalStudents.includes(studentId)) {
      setAdditionalStudents([...additionalStudents, studentId]);
      handleAttendanceChange(studentId, true);
    }
    setSearchTerm('');
    setShowSearch(false);
  };

  const handleRemoveStudent = (studentId: string) => {
    setAdditionalStudents(additionalStudents.filter((id) => id !== studentId));
    onUpdate(studentAttendance.filter((sa) => sa.studentId !== studentId));
  };

  const getStudentAttendance = (studentId: string) => {
    return studentAttendance.find((sa) => sa.studentId === studentId);
  };

  const isStudentAlreadyAdded = useCallback((studentId: string) => {
    return (
      sessionStudents.some((ss) => ss.student_id === studentId) ||
      additionalStudents.includes(studentId)
    );
  }, [sessionStudents, additionalStudents]);

  const filteredStudents = useMemo(() => {
    return allStudents.filter(
      (student) =>
        !isStudentAlreadyAdded(student.id) &&
        (searchTerm === '' ||
          `${student.first_name} ${student.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase()))
    );
  }, [allStudents, searchTerm, isStudentAlreadyAdded]);

  return {
    // Data
    sessionStudents,
    allStudents,
    filteredStudents,
    isLoading,
    
    // UI state
    additionalStudents,
    showSearch,
    searchTerm,
    setShowSearch,
    setSearchTerm,
    
    // Actions
    handleAttendanceChange,
    handleAddStudent,
    handleRemoveStudent,
    getStudentAttendance,
    isStudentAlreadyAdded,
  };
}
