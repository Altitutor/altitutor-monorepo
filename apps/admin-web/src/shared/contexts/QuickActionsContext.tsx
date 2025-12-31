'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface QuickActionsContextType {
  isTutorLogModalOpen: boolean;
  isLogAbsenceDialogOpen: boolean;
  openTutorLogModal: () => void;
  closeTutorLogModal: () => void;
  openLogAbsenceDialog: () => void;
  closeLogAbsenceDialog: () => void;
}

const QuickActionsContext = createContext<QuickActionsContextType | undefined>(undefined);

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [isTutorLogModalOpen, setIsTutorLogModalOpen] = useState(false);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);

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

  return (
    <QuickActionsContext.Provider
      value={{
        isTutorLogModalOpen,
        isLogAbsenceDialogOpen,
        openTutorLogModal,
        closeTutorLogModal,
        openLogAbsenceDialog,
        closeLogAbsenceDialog,
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

