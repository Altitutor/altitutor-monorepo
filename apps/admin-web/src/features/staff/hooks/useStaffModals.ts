import { useState, useCallback } from 'react';

interface UseStaffModalsReturn {
  // Modal states
  isLogAbsenceDialogOpen: boolean;
  isDeleteDialogOpen: boolean;
  inviteDialogOpen: boolean;
  subjectModalOpen: boolean;
  selectedSubjectId: string | null;
  
  // Actions
  openLogAbsence: () => void;
  closeLogAbsence: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  openInviteDialog: () => void;
  closeInviteDialog: () => void;
  openSubjectModal: (subjectId: string) => void;
  closeSubjectModal: () => void;
  reset: () => void;
}

/**
 * Hook for managing all staff-related modal states
 */
export function useStaffModals(): UseStaffModalsReturn {
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const openLogAbsence = useCallback(() => {
    setIsLogAbsenceDialogOpen(true);
  }, []);

  const closeLogAbsence = useCallback(() => {
    setIsLogAbsenceDialogOpen(false);
  }, []);

  const openDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  const openInviteDialog = useCallback(() => {
    setInviteDialogOpen(true);
  }, []);

  const closeInviteDialog = useCallback(() => {
    setInviteDialogOpen(false);
  }, []);

  const openSubjectModal = useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSubjectModalOpen(true);
  }, []);

  const closeSubjectModal = useCallback(() => {
    setSubjectModalOpen(false);
    setSelectedSubjectId(null);
  }, []);

  const reset = useCallback(() => {
    setIsLogAbsenceDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setInviteDialogOpen(false);
    setSubjectModalOpen(false);
    setSelectedSubjectId(null);
  }, []);

  return {
    isLogAbsenceDialogOpen,
    isDeleteDialogOpen,
    inviteDialogOpen,
    subjectModalOpen,
    selectedSubjectId,
    openLogAbsence,
    closeLogAbsence,
    openDeleteDialog,
    closeDeleteDialog,
    openInviteDialog,
    closeInviteDialog,
    openSubjectModal,
    closeSubjectModal,
    reset,
  };
}
