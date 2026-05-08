import { useContext, useCallback } from 'react';
import { QuickActionsContext } from '@/shared/contexts/QuickActionsContext';

/**
 * Safely get command palette actions
 * Returns null if QuickActionsProvider is not available
 */
export function useCommandPaletteActions() {
  const context = useContext(QuickActionsContext);
  // Return null if context is undefined (provider not available)
  return context ?? null;
}

/**
 * Get command actions that can be used in CommandPalette
 * Returns actions wrapped in callbacks, or null if provider unavailable
 */
export function useCommandPaletteCommandActions(onClose: () => void) {
  const quickActions = useCommandPaletteActions();

  // All hooks must be called unconditionally - move them before the early return
  const openTrialSession = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openBookingModal('TRIAL_SESSION');
    }
  }, [onClose, quickActions]);

  const openSubsidyInterview = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openBookingModal('SUBSIDY_INTERVIEW');
    }
  }, [onClose, quickActions]);

  const openDrafting = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openBookingModal('DRAFTING');
    }
  }, [onClose, quickActions]);

  const openStaffInterview = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openBookingModal('STAFF_INTERVIEW');
    }
  }, [onClose, quickActions]);

  const openTutorLog = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openTutorLogModal();
    }
  }, [onClose, quickActions]);

  const openLogStudentAbsence = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openLogAbsenceDialog();
    }
  }, [onClose, quickActions]);

  const openLogStaffAbsence = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openLogStaffAbsenceDialog();
    }
  }, [onClose, quickActions]);

  const openCreateTask = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openCreateTaskDialog();
    }
  }, [onClose, quickActions]);

  const openCreateIssue = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openCreateIssueDialog();
    }
  }, [onClose, quickActions]);

  const openCreateProject = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openCreateProjectDialog();
    }
  }, [onClose, quickActions]);

  const openAnnouncementsModal = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openAnnouncementsModal();
    }
  }, [onClose, quickActions]);

  const openBookCheckIn = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openCheckInModal();
    }
  }, [onClose, quickActions]);

  const openBookAdminMeeting = useCallback(() => {
    if (quickActions) {
      onClose();
      quickActions.openCheckInModal(null, 'ADMIN_MEETING');
    }
  }, [onClose, quickActions]);

  if (!quickActions) {
    return null;
  }

  return {
    openTrialSession,
    openSubsidyInterview,
    openDrafting,
    openStaffInterview,
    openTutorLog,
    openLogStudentAbsence,
    openLogStaffAbsence,
    openCreateTask,
    openCreateIssue,
    openCreateProject,
    openAnnouncementsModal,
    openBookCheckIn,
    openBookAdminMeeting,
  };
}
