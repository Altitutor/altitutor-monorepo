import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseStudentEditFlowProps {
  initialSubjects: Tables<'subjects'>[];
  initialParents: Tables<'parents'>[];
}

interface UseStudentEditFlowReturn {
  // State
  isEditing: boolean;
  tempStudentSubjects: Tables<'subjects'>[];
  tempStudentParents: Tables<'parents'>[];
  subjectsToAdd: string[];
  subjectsToRemove: string[];
  parentsToAdd: string[];
  parentsToRemove: string[];
  
  // Actions
  startEdit: () => void;
  cancelEdit: () => void;
  assignSubject: (subject: Tables<'subjects'>) => void;
  removeSubject: (subjectId: string) => void;
  assignParent: (parent: Tables<'parents'>) => void;
  removeParent: (parentId: string) => void;
  reset: () => void;
}

/**
 * Hook for managing student edit flow state
 * Handles temporary subject/parent changes before submission
 */
export function useStudentEditFlow({
  initialSubjects,
  initialParents,
}: UseStudentEditFlowProps): UseStudentEditFlowReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [tempStudentParents, setTempStudentParents] = useState<Tables<'parents'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);
  const [parentsToAdd, setParentsToAdd] = useState<string[]>([]);
  const [parentsToRemove, setParentsToRemove] = useState<string[]>([]);

  const startEdit = useCallback(() => {
    setTempStudentSubjects([...initialSubjects]);
    setTempStudentParents([...initialParents]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setParentsToAdd([]);
    setParentsToRemove([]);
    setIsEditing(true);
  }, [initialSubjects, initialParents]);

  const cancelEdit = useCallback(() => {
    setTempStudentSubjects([]);
    setTempStudentParents([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setParentsToAdd([]);
    setParentsToRemove([]);
    setIsEditing(false);
  }, []);

  const assignSubject = useCallback((subject: Tables<'subjects'>) => {
    if (!subject) return;
    
    setTempStudentSubjects(prev => [...prev, subject]);
    
    if (subjectsToRemove.includes(subject.id)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
    } else {
      setSubjectsToAdd(prev => [...prev, subject.id]);
    }
  }, [subjectsToRemove]);

  const removeSubject = useCallback((subjectId: string) => {
    setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
    
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  }, [subjectsToAdd]);

  const assignParent = useCallback((parent: Tables<'parents'>) => {
    if (!parent) return;
    
    setTempStudentParents(prev => [...prev, parent]);
    
    if (parentsToRemove.includes(parent.id)) {
      setParentsToRemove(prev => prev.filter(id => id !== parent.id));
    } else {
      setParentsToAdd(prev => [...prev, parent.id]);
    }
  }, [parentsToRemove]);

  const removeParent = useCallback((parentId: string) => {
    setTempStudentParents(prev => prev.filter(p => p.id !== parentId));
    
    if (parentsToAdd.includes(parentId)) {
      setParentsToAdd(prev => prev.filter(id => id !== parentId));
    } else {
      setParentsToRemove(prev => [...prev, parentId]);
    }
  }, [parentsToAdd]);

  const reset = useCallback(() => {
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setParentsToAdd([]);
    setParentsToRemove([]);
    setIsEditing(false);
  }, []);

  return {
    isEditing,
    tempStudentSubjects,
    tempStudentParents,
    subjectsToAdd,
    subjectsToRemove,
    parentsToAdd,
    parentsToRemove,
    startEdit,
    cancelEdit,
    assignSubject,
    removeSubject,
    assignParent,
    removeParent,
    reset,
  };
}
