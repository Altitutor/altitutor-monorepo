import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseStaffActionsProps {
  staffId: string;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
  /**
   * Callback for edit details action
   */
  onEditDetails: () => void;
  /**
   * Callback for password reset/registration
   */
  onPasswordResetOrRegistration: () => void;
  /**
   * Label for password reset button
   */
  passwordResetLabel: string;
  /**
   * Callback for log absence
   */
  onLogAbsence: () => void;
  onBookCheckIn?: () => void;
  /**
   * Callback for delete action
   */
  onDelete: () => void;
}

/**
 * Hook that centralizes staff action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useStaffActions({
  staffId,
  onOpenInPage,
  onEditDetails,
  onPasswordResetOrRegistration,
  passwordResetLabel,
  onLogAbsence,
  onBookCheckIn,
  onDelete,
}: UseStaffActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/staff/${staffId}`);
    }
  }, [staffId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onEditDetails,
    onPasswordResetOrRegistration,
    passwordResetLabel,
    onLogAbsence,
    onBookCheckIn,
    onDelete,
  };
}
