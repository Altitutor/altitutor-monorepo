import { useState, useCallback } from 'react';

interface UseInvoiceModalsReturn {
  // Modal states
  studentModalOpen: boolean;
  selectedStudentId: string | null;
  sessionModalOpen: boolean;
  selectedSessionId: string | null;
  
  // Actions
  openStudentModal: (studentId: string) => void;
  closeStudentModal: () => void;
  openSessionModal: (sessionId: string) => void;
  closeSessionModal: () => void;
  reset: () => void;
}

/**
 * Hook for managing all invoice-related modal states
 */
export function useInvoiceModals(): UseInvoiceModalsReturn {
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const openStudentModal = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentModalOpen(true);
  }, []);

  const closeStudentModal = useCallback(() => {
    setStudentModalOpen(false);
    setSelectedStudentId(null);
  }, []);

  const openSessionModal = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSessionModalOpen(true);
  }, []);

  const closeSessionModal = useCallback(() => {
    setSessionModalOpen(false);
    setSelectedSessionId(null);
  }, []);

  const reset = useCallback(() => {
    setStudentModalOpen(false);
    setSelectedStudentId(null);
    setSessionModalOpen(false);
    setSelectedSessionId(null);
  }, []);

  return {
    studentModalOpen,
    selectedStudentId,
    sessionModalOpen,
    selectedSessionId,
    openStudentModal,
    closeStudentModal,
    openSessionModal,
    closeSessionModal,
    reset,
  };
}
