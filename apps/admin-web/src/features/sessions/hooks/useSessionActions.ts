import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseSessionActionsProps {
  sessionId: string;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
  /**
   * Optional callback for log session action
   */
  onLogSession?: () => void;
  /**
   * Whether the session has a tutor log
   */
  hasTutorLog: boolean;
  /**
   * Optional callback for reschedule action
   */
  onReschedule?: () => void;
  /**
   * Whether the session can be rescheduled
   */
  canReschedule?: boolean;
}

/**
 * Hook that centralizes session action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useSessionActions({
  sessionId,
  onOpenInPage,
  onLogSession,
  hasTutorLog,
  onReschedule,
  canReschedule,
}: UseSessionActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/sessions/${sessionId}`);
    }
  }, [sessionId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onLogSession: !hasTutorLog ? onLogSession : undefined,
    hasTutorLog,
    onReschedule: canReschedule ? onReschedule : undefined,
    canReschedule,
  };
}
