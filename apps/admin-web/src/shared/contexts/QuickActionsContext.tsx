'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface QuickActionsContextType {
  isTutorLogModalOpen: boolean;
  isLogAbsenceDialogOpen: boolean;
  isLogStaffAbsenceDialogOpen: boolean;
  isAnnouncementsModalOpen: boolean;
  isCreateTaskDialogOpen: boolean;
  isCreateIssueDialogOpen: boolean;
  isCreateProjectDialogOpen: boolean;
  bookingSessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | null;
  isBookingModalOpen: boolean;
  openTutorLogModal: () => void;
  closeTutorLogModal: () => void;
  openLogAbsenceDialog: () => void;
  closeLogAbsenceDialog: () => void;
  openLogStaffAbsenceDialog: () => void;
  closeLogStaffAbsenceDialog: () => void;
  openAnnouncementsModal: () => void;
  closeAnnouncementsModal: () => void;
  openCreateTaskDialog: () => void;
  closeCreateTaskDialog: () => void;
  openCreateIssueDialog: () => void;
  closeCreateIssueDialog: () => void;
  openCreateProjectDialog: () => void;
  closeCreateProjectDialog: () => void;
  openBookingModal: (sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW') => void;
  closeBookingModal: () => void;
}

export const QuickActionsContext = createContext<QuickActionsContextType | undefined>(undefined);

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [isTutorLogModalOpen, setIsTutorLogModalOpen] = useState(false);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isLogStaffAbsenceDialogOpen, setIsLogStaffAbsenceDialogOpen] = useState(false);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [isCreateIssueDialogOpen, setIsCreateIssueDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

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

  const openAnnouncementsModal = useCallback(() => {
    setIsAnnouncementsModalOpen(true);
  }, []);

  const closeAnnouncementsModal = useCallback(() => {
    setIsAnnouncementsModalOpen(false);
  }, []);

  const openCreateTaskDialog = useCallback(() => {
    setIsCreateTaskDialogOpen(true);
  }, []);

  const closeCreateTaskDialog = useCallback(() => {
    setIsCreateTaskDialogOpen(false);
  }, []);

  const openCreateIssueDialog = useCallback(() => {
    setIsCreateIssueDialogOpen(true);
  }, []);

  const closeCreateIssueDialog = useCallback(() => {
    setIsCreateIssueDialogOpen(false);
  }, []);

  const openCreateProjectDialog = useCallback(() => {
    setIsCreateProjectDialogOpen(true);
  }, []);

  const closeCreateProjectDialog = useCallback(() => {
    setIsCreateProjectDialogOpen(false);
  }, []);

  const openBookingModal = useCallback((sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW') => {
    setBookingSessionType(sessionType);
    setIsBookingModalOpen(true);
  }, []);

  const closeBookingModal = useCallback(() => {
    setIsBookingModalOpen(false);
    setBookingSessionType(null);
  }, []);

  return (
    <QuickActionsContext.Provider
      value={{
        isTutorLogModalOpen,
        isLogAbsenceDialogOpen,
        isLogStaffAbsenceDialogOpen,
        isAnnouncementsModalOpen,
        isCreateTaskDialogOpen,
        isCreateIssueDialogOpen,
        isCreateProjectDialogOpen,
        bookingSessionType,
        isBookingModalOpen,
        openTutorLogModal,
        closeTutorLogModal,
        openLogAbsenceDialog,
        closeLogAbsenceDialog,
        openLogStaffAbsenceDialog,
        closeLogStaffAbsenceDialog,
        openAnnouncementsModal,
        closeAnnouncementsModal,
        openCreateTaskDialog,
        closeCreateTaskDialog,
        openCreateIssueDialog,
        closeCreateIssueDialog,
        openCreateProjectDialog,
        closeCreateProjectDialog,
        openBookingModal,
        closeBookingModal,
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
