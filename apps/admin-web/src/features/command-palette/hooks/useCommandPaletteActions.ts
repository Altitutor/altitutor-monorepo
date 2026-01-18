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

  if (!quickActions) {
    return null;
  }

  return {
    openTrialSession: useCallback(() => {
      onClose();
      quickActions.openBookingModal('TRIAL_SESSION');
    }, [onClose, quickActions]),
    openSubsidyInterview: useCallback(() => {
      onClose();
      quickActions.openBookingModal('SUBSIDY_INTERVIEW');
    }, [onClose, quickActions]),
    openDrafting: useCallback(() => {
      onClose();
      quickActions.openBookingModal('DRAFTING');
    }, [onClose, quickActions]),
    openTutorLog: useCallback(() => {
      onClose();
      quickActions.openTutorLogModal();
    }, [onClose, quickActions]),
    openLogStudentAbsence: useCallback(() => {
      onClose();
      quickActions.openLogAbsenceDialog();
    }, [onClose, quickActions]),
    openLogStaffAbsence: useCallback(() => {
      onClose();
      quickActions.openLogStaffAbsenceDialog();
    }, [onClose, quickActions]),
  };
}
