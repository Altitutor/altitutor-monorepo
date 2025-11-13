'use client';

import { useQuery } from '@tanstack/react-query';
import { classesApi } from '@/features/classes/api';
import type { Tables } from '@altitutor/shared';

export interface StudentClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  students?: Tables<'students'>[];
  studentCount: number;
}

/**
 * Get classes that a student is enrolled in
 */
export function useStudentClasses(studentId: string) {
  return useQuery({
    queryKey: ['students', studentId, 'classes'],
    queryFn: async (): Promise<StudentClass[]> => {
      const { classes, classSubjects, classStaff, classStudents } = 
        await classesApi.getAllClassesWithDetails();
      
      // Filter to only enrolled classes
      const enrolledClasses = classes.filter(cls => {
        const students = classStudents[cls.id] || [];
        return students.some(s => s.id === studentId);
      });
      
      // Transform to StudentClass format
      return enrolledClasses.map(cls => ({
        class: cls,
        subject: classSubjects[cls.id],
        staff: classStaff[cls.id] || [],
        students: classStudents[cls.id] || [],
        studentCount: (classStudents[cls.id] || []).length
      }));
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!studentId,
  });
}

/**
 * Get all classes (for enrollment modal - includes classes student is not enrolled in)
 */
export function useAllClassesForStudent(studentId: string) {
  return useQuery({
    queryKey: ['students', studentId, 'allClasses'],
    queryFn: async (): Promise<StudentClass[]> => {
      const { classes, classSubjects, classStaff, classStudents } = 
        await classesApi.getAllClassesWithDetails();
      
      return classes.map(cls => ({
        class: cls,
        subject: classSubjects[cls.id],
        staff: classStaff[cls.id] || [],
        students: classStudents[cls.id] || [],
        studentCount: (classStudents[cls.id] || []).length
      }));
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!studentId,
  });
}

