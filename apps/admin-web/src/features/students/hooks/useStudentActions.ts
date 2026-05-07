import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseStudentActionsProps {
  studentId: string;
  student?: Tables<'students'> | null;
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
  /**
   * Callback for book drafting session
   */
  onBookDraftingSession: () => void;
  /** Opens global book check-in with this student pre-selected */
  onBookCheckIn?: () => void;
  /**
   * Optional callback for discontinue action
   */
  onDiscontinue?: () => void;
  /**
   * Callback for delete action
   */
  onDelete: () => void;
}

/**
 * Hook that centralizes student action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useStudentActions({
  studentId,
  student,
  onOpenInPage,
  onEditDetails,
  onPasswordResetOrRegistration,
  passwordResetLabel,
  onLogAbsence,
  onBookDraftingSession,
  onBookCheckIn,
  onDiscontinue,
  onDelete,
}: UseStudentActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/students/${studentId}`);
    }
  }, [studentId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onEditDetails,
    onPasswordResetOrRegistration,
    passwordResetLabel,
    onLogAbsence,
    onBookDraftingSession,
    onBookCheckIn,
    onDiscontinue: student && (student.status === 'TRIAL' || student.status === 'ACTIVE')
      ? onDiscontinue
      : undefined,
    onDelete,
  };
}
