import { useState, useCallback } from 'react';

export interface UseSessionsTableModalsReturn {
  // Log session
  actionSessionId: string | null;
  setActionSessionId: (id: string | null) => void;
  isLogSessionModalOpen: boolean;
  openLogSessionModal: (sessionId: string) => void;
  closeLogSessionModal: () => void;

  // Log student absence (student attendance view)
  studentAbsenceSessionId: string | null;
  isLogAbsenceDialogOpen: boolean;
  openLogAbsenceDialog: (sessionId: string) => void;
  closeLogAbsenceDialog: () => Promise<void>;

  // Class modal
  selectedClassId: string | null;
  isClassModalOpen: boolean;
  openClassModal: (classId: string) => void;
  closeClassModal: () => void;

  // Edit tutor log
  selectedTutorLogId: string | null;
  isEditTutorLogModalOpen: boolean;
  openEditTutorLogModal: (tutorLogId: string) => void;
  closeEditTutorLogModal: () => void;
}

export function useSessionsTableModals(refetch: () => void | Promise<unknown>): UseSessionsTableModalsReturn {
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [studentAbsenceSessionId, setStudentAbsenceSessionId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [selectedTutorLogId, setSelectedTutorLogId] = useState<string | null>(null);
  const [isEditTutorLogModalOpen, setIsEditTutorLogModalOpen] = useState(false);

  const openLogSessionModal = useCallback((sessionId: string) => {
    setActionSessionId(sessionId);
    setIsLogSessionModalOpen(true);
  }, []);

  const closeLogSessionModal = useCallback(() => {
    setIsLogSessionModalOpen(false);
    setActionSessionId(null);
    refetch();
  }, [refetch]);

  const openLogAbsenceDialog = useCallback((sessionId: string) => {
    setStudentAbsenceSessionId(sessionId);
    setIsLogAbsenceDialogOpen(true);
  }, []);

  const closeLogAbsenceDialog = useCallback(async () => {
    setIsLogAbsenceDialogOpen(false);
    setStudentAbsenceSessionId(null);
    await refetch();
  }, [refetch]);

  const openClassModal = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const closeClassModal = useCallback(() => {
    setIsClassModalOpen(false);
    setSelectedClassId(null);
    refetch();
  }, [refetch]);

  const openEditTutorLogModal = useCallback((tutorLogId: string) => {
    setSelectedTutorLogId(tutorLogId);
    setIsEditTutorLogModalOpen(true);
  }, []);

  const closeEditTutorLogModal = useCallback(() => {
    setIsEditTutorLogModalOpen(false);
    setSelectedTutorLogId(null);
    refetch();
  }, [refetch]);

  return {
    actionSessionId,
    setActionSessionId,
    isLogSessionModalOpen,
    openLogSessionModal,
    closeLogSessionModal,
    studentAbsenceSessionId,
    isLogAbsenceDialogOpen,
    openLogAbsenceDialog,
    closeLogAbsenceDialog,
    selectedClassId,
    isClassModalOpen,
    openClassModal,
    closeClassModal,
    selectedTutorLogId,
    isEditTutorLogModalOpen,
    openEditTutorLogModal,
    closeEditTutorLogModal,
  };
}
