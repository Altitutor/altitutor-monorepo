import { useState, useEffect, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { staffApi } from '../api';
import { classesApi } from '@/features/classes/api';

interface UseStaffDataReturn {
  staffMembers: Tables<'staff'>[];
  staffClasses: Record<string, Tables<'classes'>[]>;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useStaffData(refreshTrigger?: number): UseStaffDataReturn {
  const [staffMembers, setStaffMembers] = useState<Tables<'staff'>[]>([]);
  const [staffClasses, setStaffClasses] = useState<Record<string, Tables<'classes'>[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaffData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await staffApi.getAllStaff();
      setStaffMembers(data);
      
      // Load classes for each staff member
      const classesData: Record<string, Tables<'classes'>[]> = {};
      const { classes: allClasses, classStaff } = await classesApi.getAllClassesWithDetails();
      
      // Filter classes for each staff member
      for (const staff of data) {
        const staffClassesList: Tables<'classes'>[] = [];
        
        for (const cls of allClasses) {
          const assignedStaff = classStaff[cls.id] || [];
          const isAssigned = assignedStaff.some(assignedStaffMember => 
            assignedStaffMember.id === staff.id
          );
          
          if (isAssigned) {
            staffClassesList.push(cls);
          }
        }
        
        classesData[staff.id] = staffClassesList;
      }
      
      setStaffClasses(classesData);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError('Failed to load staff. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData, refreshTrigger]);

  return {
    staffMembers,
    staffClasses,
    loading,
    error,
    refreshData: loadStaffData,
  };
} 