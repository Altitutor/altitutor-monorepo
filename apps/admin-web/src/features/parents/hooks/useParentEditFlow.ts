import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseParentEditFlowProps {
  initialStudents: Tables<'students'>[];
}

interface UseParentEditFlowReturn {
  // State
  isEditing: boolean;
  tempParentStudents: Tables<'students'>[];
  studentsToAdd: string[];
  studentsToRemove: string[];
  
  // Actions
  startEdit: () => void;
  cancelEdit: () => void;
  assignStudent: (student: Tables<'students'>) => void;
  removeStudent: (studentId: string) => void;
  reset: () => void;
}

/**
 * Hook for managing parent edit flow state
 * Handles temporary student changes before submission
 */
export function useParentEditFlow({
  initialStudents,
}: UseParentEditFlowProps): UseParentEditFlowReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [tempParentStudents, setTempParentStudents] = useState<Tables<'students'>[]>([]);
  const [studentsToAdd, setStudentsToAdd] = useState<string[]>([]);
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([]);

  const startEdit = useCallback(() => {
    setTempParentStudents([...initialStudents]);
    setStudentsToAdd([]);
    setStudentsToRemove([]);
    setIsEditing(true);
  }, [initialStudents]);

  const cancelEdit = useCallback(() => {
    setTempParentStudents([]);
    setStudentsToAdd([]);
    setStudentsToRemove([]);
    setIsEditing(false);
  }, []);

  const assignStudent = useCallback((student: Tables<'students'>) => {
    if (!student) return;
    
    setTempParentStudents(prev => [...prev, student]);
    
    if (studentsToRemove.includes(student.id)) {
      setStudentsToRemove(prev => prev.filter(id => id !== student.id));
    } else {
      setStudentsToAdd(prev => [...prev, student.id]);
    }
  }, [studentsToRemove]);

  const removeStudent = useCallback((studentId: string) => {
    setTempParentStudents(prev => prev.filter(s => s.id !== studentId));
    
    if (studentsToAdd.includes(studentId)) {
      setStudentsToAdd(prev => prev.filter(id => id !== studentId));
    } else {
      setStudentsToRemove(prev => [...prev, studentId]);
    }
  }, [studentsToAdd]);

  const reset = useCallback(() => {
    setStudentsToAdd([]);
    setStudentsToRemove([]);
    setIsEditing(false);
  }, []);

  return {
    isEditing,
    tempParentStudents,
    studentsToAdd,
    studentsToRemove,
    startEdit,
    cancelEdit,
    assignStudent,
    removeStudent,
    reset,
  };
}
