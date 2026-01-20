import { useState, useMemo, useCallback } from 'react';
import type { ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, EnrollmentFilters, StudentWithEnrollmentInfo } from '../types/enrollment';
import {
  filterStudents,
  filterClasses,
  getAvailableYearLevels,
  getAvailableSubjects,
  getAvailableDays,
} from '../utils/enrollmentFilters';

interface UseEnrollmentFiltersProps {
  context: EnrollmentContext;
  students: StudentWithEnrollmentInfo[];
  classes: ClassWithExpandedSubject[];
  enrolledStudentIds: string[];
  enrolledClassIds: string[];
  subjectId?: string;
  defaultSubjectFilters?: string[];
}

export function useEnrollmentFilters({
  context,
  students,
  classes,
  enrolledStudentIds,
  enrolledClassIds,
  subjectId,
  defaultSubjectFilters = [],
}: UseEnrollmentFiltersProps) {
  const [filters, setFilters] = useState<EnrollmentFilters>({
    searchQuery: '',
    yearLevelFilters: [],
    subjectFilters: defaultSubjectFilters,
    dayFilters: [],
  });

  const filteredStudents = useMemo(() => {
    if (context !== 'class') return [];
    return filterStudents(students, filters, enrolledStudentIds);
  }, [context, students, filters, enrolledStudentIds]);

  const filteredClasses = useMemo(() => {
    if (context !== 'student') return [];
    return filterClasses(classes, filters, enrolledClassIds);
  }, [context, classes, filters, enrolledClassIds]);

  const availableYearLevels = useMemo(
    () => getAvailableYearLevels(students, classes, context),
    [students, classes, context]
  );

  const availableSubjects = useMemo(
    () => getAvailableSubjects(students, classes, context, subjectId),
    [students, classes, context, subjectId]
  );

  const availableDays = useMemo(
    () => (context === 'student' ? getAvailableDays(classes) : []),
    [context, classes]
  );

  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const toggleYearLevel = useCallback((level: number) => {
    setFilters(prev => ({
      ...prev,
      yearLevelFilters: prev.yearLevelFilters.includes(level)
        ? prev.yearLevelFilters.filter(l => l !== level)
        : [...prev.yearLevelFilters, level],
    }));
  }, []);

  const toggleSubject = useCallback((subjectId: string) => {
    setFilters(prev => ({
      ...prev,
      subjectFilters: prev.subjectFilters.includes(subjectId)
        ? prev.subjectFilters.filter(id => id !== subjectId)
        : [...prev.subjectFilters, subjectId],
    }));
  }, []);

  const toggleDay = useCallback((day: number) => {
    setFilters(prev => ({
      ...prev,
      dayFilters: prev.dayFilters.includes(day)
        ? prev.dayFilters.filter(d => d !== day)
        : [...prev.dayFilters, day],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      yearLevelFilters: [],
      subjectFilters: defaultSubjectFilters,
      dayFilters: [],
    });
  }, [defaultSubjectFilters]);

  const resetFilters = useCallback((defaultSubjectFilters: string[]) => {
    setFilters({
      searchQuery: '',
      yearLevelFilters: [],
      subjectFilters: defaultSubjectFilters,
      dayFilters: [],
    });
  }, []);

  return {
    filters,
    filteredStudents,
    filteredClasses,
    availableYearLevels,
    availableSubjects,
    availableDays,
    setSearchQuery,
    toggleYearLevel,
    toggleSubject,
    toggleDay,
    clearFilters,
    resetFilters,
  };
}

