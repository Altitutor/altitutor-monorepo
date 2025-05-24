import { useState, useEffect, useCallback } from 'react';
import { Staff, Class } from '@/lib/supabase/db/types';
import { staffApi, classesApi } from '@/lib/supabase/api';

interface UseStaffDataReturn {
  staffMembers: Staff[];
  staffClasses: Record<string, Class[]>;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useStaffData(refreshTrigger?: number): UseStaffDataReturn {
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [staffClasses, setStaffClasses] = useState<Record<string, Class[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaffData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await staffApi.getAllStaff();
      setStaffMembers(data);
      
      // Load classes for each staff member
      const classesData: Record<string, Class[]> = {};
      const { classes: allClasses, classStaff } = await classesApi.getAllClassesWithDetails();
      
      // Filter classes for each staff member
      for (const staff of data) {
        const staffClassesList: Class[] = [];
        
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