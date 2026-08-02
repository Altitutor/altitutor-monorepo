import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

type StudentStatus = Tables<'students'>['status'];

function isBookableStatus(status: StudentStatus | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIAL';
}

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
   * Callback for book trial session
   */
  onBookTrialSession?: () => void;
  /**
   * Callback for book drafting session
   */
  onBookDraftingSession?: () => void;
  /**
   * Callback for book subsidy interview
   */
  onBookSubsidyInterview?: () => void;
  /** Opens global book check-in with this student pre-selected */
  onBookCheckIn?: () => void;
  /**
   * Optional callback for discontinue action
   */
  onDiscontinue?: () => void;
  /**
   * Optional callback for re-enroll (DISCONTINUED → ACTIVE)
   */
  onReEnroll?: () => void;
  /**
   * Callback for delete action
   */
  onDelete: () => void;
}

/**
 * Hook that centralizes student action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 *
 * Booking / absence / discontinue actions are only exposed for ACTIVE or TRIAL.
 * Re-enroll is only exposed for DISCONTINUED.
 */
export function useStudentActions({
  studentId,
  student,
  onOpenInPage,
  onEditDetails,
  onPasswordResetOrRegistration,
  passwordResetLabel,
  onLogAbsence,
  onBookTrialSession,
  onBookDraftingSession,
  onBookSubsidyInterview,
  onBookCheckIn,
  onDiscontinue,
  onReEnroll,
  onDelete,
}: UseStudentActionsProps) {
  const router = useRouter();
  const canBook = isBookableStatus(student?.status);

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
    onLogAbsence: canBook ? onLogAbsence : undefined,
    onBookTrialSession: canBook ? onBookTrialSession : undefined,
    onBookDraftingSession: canBook ? onBookDraftingSession : undefined,
    onBookSubsidyInterview: canBook ? onBookSubsidyInterview : undefined,
    onBookCheckIn: canBook ? onBookCheckIn : undefined,
    onDiscontinue: canBook ? onDiscontinue : undefined,
    onReEnroll: student?.status === 'DISCONTINUED' ? onReEnroll : undefined,
    onDelete,
  };
}
