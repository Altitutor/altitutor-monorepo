import { useState, useCallback } from 'react';

interface UseParentModalsReturn {
  // Modal states
  studentModalOpen: boolean;
  selectedStudentId: string | null;
  
  // Actions
  openStudentModal: (studentId: string) => void;
  closeStudentModal: () => void;
  reset: () => void;
}

/**
 * Hook for managing all parent-related modal states
 */
export function useParentModals(): UseParentModalsReturn {
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const openStudentModal = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentModalOpen(true);
  }, []);

  const closeStudentModal = useCallback(() => {
    setStudentModalOpen(false);
    setSelectedStudentId(null);
  }, []);

  const reset = useCallback(() => {
    setStudentModalOpen(false);
    setSelectedStudentId(null);
  }, []);

  return {
    studentModalOpen,
    selectedStudentId,
    openStudentModal,
    closeStudentModal,
    reset,
  };
}
