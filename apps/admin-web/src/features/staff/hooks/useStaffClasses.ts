'use client';

import { useQuery } from '@tanstack/react-query';
import { classesApi } from '@/features/classes/api';
import type { Tables } from '@altitutor/shared';

export interface StaffClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  studentCount: number;
}

/**
 * Get classes that a staff member is assigned to
 */
export function useStaffClasses(staffId: string) {
  return useQuery({
    queryKey: ['staff', staffId, 'classes'],
    queryFn: async (): Promise<StaffClass[]> => {
      const { classes, classSubjects, classStaff, classStudents } = 
        await classesApi.getAllClassesWithDetails();
      
      // Filter to only assigned classes
      const assignedClasses = classes.filter(cls => {
        const staff = classStaff[cls.id] || [];
        return staff.some(s => s.id === staffId);
      });
      
      return assignedClasses.map(cls => ({
        class: cls,
        subject: classSubjects[cls.id],
        staff: classStaff[cls.id] || [],
        studentCount: (classStudents[cls.id] || []).length
      }));
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!staffId,
  });
}

