import { useState, useCallback } from 'react';

/**
 * Hook to manage all reconciliation modal states
 */
export function useReconciliationModals() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionInitialSessionId, setLogSessionInitialSessionId] = useState<string | undefined>();
  const [logSessionInitialStaffId, setLogSessionInitialStaffId] = useState<string | undefined>();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  const [assignStaffClassId, setAssignStaffClassId] = useState<string | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollModalStudentId, setEnrollModalStudentId] = useState<string | null>(null);
  const [enrollModalSubjectId, setEnrollModalSubjectId] = useState<string | null>(null);

  const handleOpenStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  }, []);

  const handleCloseStudent = useCallback(() => {
    setIsStudentModalOpen(false);
    setSelectedStudentId(null);
  }, []);

  const handleLogSession = useCallback((sessionId: string, staffId?: string) => {
    setLogSessionInitialSessionId(sessionId);
    setLogSessionInitialStaffId(staffId);
    setIsLogSessionModalOpen(true);
  }, []);

  const handleCloseLogSession = useCallback(() => {
    setIsLogSessionModalOpen(false);
    setLogSessionInitialSessionId(undefined);
    setLogSessionInitialStaffId(undefined);
  }, []);

  const handleOpenInvoice = useCallback((invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsInvoiceModalOpen(true);
  }, []);

  const handleCloseInvoice = useCallback(() => {
    setIsInvoiceModalOpen(false);
    setSelectedInvoiceId(null);
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  }, []);

  const handleCloseSession = useCallback(() => {
    setIsSessionModalOpen(false);
    setSelectedSessionId(null);
  }, []);

  const handleOpenClass = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleCloseClass = useCallback(() => {
    setIsClassModalOpen(false);
    setSelectedClassId(null);
  }, []);

  const handleAssignStaff = useCallback((classId: string) => {
    setAssignStaffClassId(classId);
    setIsAssignStaffModalOpen(true);
  }, []);

  const handleCloseAssignStaff = useCallback(() => {
    setIsAssignStaffModalOpen(false);
    setAssignStaffClassId(null);
  }, []);

  const handleAddClass = useCallback((studentId: string, subjectId: string) => {
    setEnrollModalStudentId(studentId);
    setEnrollModalSubjectId(subjectId);
    setIsEnrollModalOpen(true);
  }, []);

  const handleCloseEnroll = useCallback(() => {
    setIsEnrollModalOpen(false);
    setEnrollModalStudentId(null);
    setEnrollModalSubjectId(null);
  }, []);

  return {
    // Student modal
    selectedStudentId,
    isStudentModalOpen,
    handleOpenStudent,
    handleCloseStudent,
    // Log session modal
    isLogSessionModalOpen,
    logSessionInitialSessionId,
    logSessionInitialStaffId,
    handleLogSession,
    handleCloseLogSession,
    // Invoice modal
    selectedInvoiceId,
    isInvoiceModalOpen,
    handleOpenInvoice,
    handleCloseInvoice,
    // Session modal
    selectedSessionId,
    isSessionModalOpen,
    handleOpenSession,
    handleCloseSession,
    // Class modal
    selectedClassId,
    isClassModalOpen,
    handleOpenClass,
    handleCloseClass,
    // Assign staff modal
    isAssignStaffModalOpen,
    assignStaffClassId,
    handleAssignStaff,
    handleCloseAssignStaff,
    // Enroll modal
    isEnrollModalOpen,
    enrollModalStudentId,
    enrollModalSubjectId,
    handleAddClass,
    handleCloseEnroll,
  };
}
