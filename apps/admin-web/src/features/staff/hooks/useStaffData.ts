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
      
      // Build staffId -> classes map in a single pass over assignments
      const classesData: Record<string, Tables<'classes'>[]> = {};
      const { classes: allClasses, classStaff } = await classesApi.getAllClassesWithDetails();

      // Initialize keys for all staff
      for (const s of data) {
        classesData[s.id] = [];
      }

      // For each class, push into each assigned staff bucket
      for (const cls of allClasses) {
        const assigned = classStaff[cls.id] || [];
        for (const st of assigned) {
          if (!classesData[st.id]) classesData[st.id] = [];
          classesData[st.id].push(cls);
        }
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