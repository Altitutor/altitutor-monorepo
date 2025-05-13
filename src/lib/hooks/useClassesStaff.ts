import { useState, useCallback } from 'react';
import { ClassAssignment } from '../supabase/db/types';
import { classesStaffRepository } from '../supabase/db/repositories';
import { useRepository } from './useRepository';

export function useClassesStaff() {
  const repository = useRepository(classesStaffRepository);
  const [fetchByClassIdLoading, setFetchByClassIdLoading] = useState(false);
  const [fetchByClassIdError, setFetchByClassIdError] = useState<string | null>(null);

  // Custom function to fetch staff for a specific class
  const fetchByClassId = useCallback(async (classId: string) => {
    setFetchByClassIdLoading(true);
    setFetchByClassIdError(null);
    try {
      const data = await classesStaffRepository.getBy('class_id', classId);
      // Update the items in the hook's state
      repository.items.length = 0; // Clear the array
      repository.items.push(...data); // Add new items
    } catch (err) {
      setFetchByClassIdError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching class staff relations:', err);
      throw err;
    } finally {
      setFetchByClassIdLoading(false);
    }
  }, [repository.items]);

  // Combine the custom loading and error states with the repository's
  const loading = repository.loading || fetchByClassIdLoading;
  const error = repository.error || fetchByClassIdError;

  return {
    ...repository,
    fetchByClassId,
    loading,
    error
  };
} 