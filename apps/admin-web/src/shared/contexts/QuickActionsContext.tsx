'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface QuickActionsContextType {
  isTutorLogModalOpen: boolean;
  isLogAbsenceDialogOpen: boolean;
  isLogStaffAbsenceDialogOpen: boolean;
  openTutorLogModal: () => void;
  closeTutorLogModal: () => void;
  openLogAbsenceDialog: () => void;
  closeLogAbsenceDialog: () => void;
  openLogStaffAbsenceDialog: () => void;
  closeLogStaffAbsenceDialog: () => void;
}

const QuickActionsContext = createContext<QuickActionsContextType | undefined>(undefined);

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [isTutorLogModalOpen, setIsTutorLogModalOpen] = useState(false);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isLogStaffAbsenceDialogOpen, setIsLogStaffAbsenceDialogOpen] = useState(false);

  const openTutorLogModal = useCallback(() => {
    setIsTutorLogModalOpen(true);
  }, []);

  const closeTutorLogModal = useCallback(() => {
    setIsTutorLogModalOpen(false);
  }, []);

  const openLogAbsenceDialog = useCallback(() => {
    setIsLogAbsenceDialogOpen(true);
  }, []);

  const closeLogAbsenceDialog = useCallback(() => {
    setIsLogAbsenceDialogOpen(false);
  }, []);

  const openLogStaffAbsenceDialog = useCallback(() => {
    setIsLogStaffAbsenceDialogOpen(true);
  }, []);

  const closeLogStaffAbsenceDialog = useCallback(() => {
    setIsLogStaffAbsenceDialogOpen(false);
  }, []);

  return (
    <QuickActionsContext.Provider
      value={{
        isTutorLogModalOpen,
        isLogAbsenceDialogOpen,
        isLogStaffAbsenceDialogOpen,
        openTutorLogModal,
        closeTutorLogModal,
        openLogAbsenceDialog,
        closeLogAbsenceDialog,
        openLogStaffAbsenceDialog,
        closeLogStaffAbsenceDialog,
      }}
    >
      {children}
    </QuickActionsContext.Provider>
  );
}

export function useQuickActions() {
  const context = useContext(QuickActionsContext);
  if (context === undefined) {
    throw new Error('useQuickActions must be used within a QuickActionsProvider');
  }
  return context;
}

