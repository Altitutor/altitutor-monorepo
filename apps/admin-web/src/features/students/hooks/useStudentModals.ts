import { useState, useCallback } from 'react';

interface UseStudentModalsReturn {
  // Modal states
  isLogAbsenceDialogOpen: boolean;
  isBookDraftingSessionModalOpen: boolean;
  isBookSubsidyInterviewModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  parentModalOpen: boolean;
  selectedParentId: string | null;
  parentModalDefaultTab: string;
  subjectModalOpen: boolean;
  selectedSubjectId: string | null;
  
  // Actions
  openLogAbsence: () => void;
  closeLogAbsence: () => void;
  openBookDraftingSession: () => void;
  closeBookDraftingSession: () => void;
  openBookSubsidyInterview: () => void;
  closeBookSubsidyInterview: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  openParentModal: (parentId: string, defaultTab?: string) => void;
  closeParentModal: () => void;
  openSubjectModal: (subjectId: string) => void;
  closeSubjectModal: () => void;
  reset: () => void;
}

/**
 * Hook for managing all student-related modal states
 */
export function useStudentModals(): UseStudentModalsReturn {
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isBookDraftingSessionModalOpen, setIsBookDraftingSessionModalOpen] = useState(false);
  const [isBookSubsidyInterviewModalOpen, setIsBookSubsidyInterviewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentModalDefaultTab, setParentModalDefaultTab] = useState<string>('students');
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const openLogAbsence = useCallback(() => {
    setIsLogAbsenceDialogOpen(true);
  }, []);

  const closeLogAbsence = useCallback(() => {
    setIsLogAbsenceDialogOpen(false);
  }, []);

  const openBookDraftingSession = useCallback(() => {
    setIsBookDraftingSessionModalOpen(true);
  }, []);

  const closeBookDraftingSession = useCallback(() => {
    setIsBookDraftingSessionModalOpen(false);
  }, []);

  const openBookSubsidyInterview = useCallback(() => {
    setIsBookSubsidyInterviewModalOpen(true);
  }, []);

  const closeBookSubsidyInterview = useCallback(() => {
    setIsBookSubsidyInterviewModalOpen(false);
  }, []);

  const openDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  const openParentModal = useCallback((parentId: string, defaultTab: string = 'students') => {
    setSelectedParentId(parentId);
    setParentModalDefaultTab(defaultTab);
    setParentModalOpen(true);
  }, []);

  const closeParentModal = useCallback(() => {
    setParentModalOpen(false);
    setSelectedParentId(null);
    setParentModalDefaultTab('students');
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
    setIsBookDraftingSessionModalOpen(false);
    setIsBookSubsidyInterviewModalOpen(false);
    setIsDeleteDialogOpen(false);
    setParentModalOpen(false);
    setSelectedParentId(null);
    setParentModalDefaultTab('students');
    setSubjectModalOpen(false);
    setSelectedSubjectId(null);
  }, []);

  return {
    isLogAbsenceDialogOpen,
    isBookDraftingSessionModalOpen,
    isBookSubsidyInterviewModalOpen,
    isDeleteDialogOpen,
    parentModalOpen,
    selectedParentId,
    parentModalDefaultTab,
    subjectModalOpen,
    selectedSubjectId,
    openLogAbsence,
    closeLogAbsence,
    openBookDraftingSession,
    closeBookDraftingSession,
    openBookSubsidyInterview,
    closeBookSubsidyInterview,
    openDeleteDialog,
    closeDeleteDialog,
    openParentModal,
    closeParentModal,
    openSubjectModal,
    closeSubjectModal,
    reset,
  };
}
