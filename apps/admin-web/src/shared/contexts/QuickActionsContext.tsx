'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/** Minimal person fields for pre-filling the check-in booking modal */
export type CheckInModalPrefill = {
  staff?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  students?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  parents?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
};

export type CheckInSessionType = 'CHECK_IN' | 'ADMIN_MEETING';

interface QuickActionsContextType {
  isTutorLogModalOpen: boolean;
  isLogAbsenceDialogOpen: boolean;
  isLogStaffAbsenceDialogOpen: boolean;
  isAnnouncementsModalOpen: boolean;
  isCreateTaskDialogOpen: boolean;
  isCreateIssueDialogOpen: boolean;
  isCreateProjectDialogOpen: boolean;
  bookingSessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW' | null;
  isBookingModalOpen: boolean;
  isCheckInModalOpen: boolean;
  checkInSessionType: CheckInSessionType;
  checkInPrefill: CheckInModalPrefill | null;
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
  openBookingModal: (sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW') => void;
  closeBookingModal: () => void;
  /** Open global check-in/admin-meeting modal; optional prefill for staff/students/parents */
  openCheckInModal: (prefill?: CheckInModalPrefill | null, sessionType?: CheckInSessionType) => void;
  closeCheckInModal: () => void;
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
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW' | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInSessionType, setCheckInSessionType] = useState<CheckInSessionType>('CHECK_IN');
  const [checkInPrefill, setCheckInPrefill] = useState<CheckInModalPrefill | null>(null);

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

  const openBookingModal = useCallback((sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW') => {
    setBookingSessionType(sessionType);
    setIsBookingModalOpen(true);
  }, []);

  const closeBookingModal = useCallback(() => {
    setIsBookingModalOpen(false);
    setBookingSessionType(null);
  }, []);

  const openCheckInModal = useCallback(
    (prefill?: CheckInModalPrefill | null, sessionType: CheckInSessionType = 'CHECK_IN') => {
    setCheckInPrefill(prefill ?? null);
    setCheckInSessionType(sessionType);
    setIsCheckInModalOpen(true);
    },
    []
  );

  const closeCheckInModal = useCallback(() => {
    setIsCheckInModalOpen(false);
    setCheckInSessionType('CHECK_IN');
    setCheckInPrefill(null);
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
        isCheckInModalOpen,
        checkInSessionType,
        checkInPrefill,
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
        openCheckInModal,
        closeCheckInModal,
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
