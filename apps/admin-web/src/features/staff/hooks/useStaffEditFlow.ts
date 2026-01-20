import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseStaffEditFlowProps {
  initialSubjects: Tables<'subjects'>[];
}

interface UseStaffEditFlowReturn {
  // State
  isEditing: boolean;
  tempStaffSubjects: Tables<'subjects'>[];
  subjectsToAdd: string[];
  subjectsToRemove: string[];
  
  // Actions
  startEdit: () => void;
  cancelEdit: () => void;
  assignSubject: (subject: Tables<'subjects'>) => void;
  removeSubject: (subjectId: string) => void;
  reset: () => void;
}

/**
 * Hook for managing staff edit flow state
 * Handles temporary subject changes before submission
 */
export function useStaffEditFlow({
  initialSubjects,
}: UseStaffEditFlowProps): UseStaffEditFlowReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  const startEdit = useCallback(() => {
    setTempStaffSubjects([...initialSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(true);
  }, [initialSubjects]);

  const cancelEdit = useCallback(() => {
    setTempStaffSubjects([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(false);
  }, []);

  const assignSubject = useCallback((subject: Tables<'subjects'>) => {
    if (!subject) return;
    
    setTempStaffSubjects(prev => [...prev, subject]);
    
    if (subjectsToRemove.includes(subject.id)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
    } else {
      setSubjectsToAdd(prev => [...prev, subject.id]);
    }
  }, [subjectsToRemove]);

  const removeSubject = useCallback((subjectId: string) => {
    setTempStaffSubjects(prev => prev.filter(s => s.id !== subjectId));
    
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  }, [subjectsToAdd]);

  const reset = useCallback(() => {
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(false);
  }, []);

  return {
    isEditing,
    tempStaffSubjects,
    subjectsToAdd,
    subjectsToRemove,
    startEdit,
    cancelEdit,
    assignSubject,
    removeSubject,
    reset,
  };
}
