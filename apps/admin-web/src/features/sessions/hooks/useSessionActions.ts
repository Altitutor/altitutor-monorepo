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
   * Optional callback for edit tutor log action (when session has a tutor log)
   */
  onEditTutorLog?: () => void;
  /**
   * Whether the session has a tutor log
   */
  hasTutorLog: boolean;
}

/**
 * Hook that centralizes session action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useSessionActions({
  sessionId,
  onOpenInPage,
  onLogSession,
  onEditTutorLog,
  hasTutorLog,
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
    onEditTutorLog: hasTutorLog ? onEditTutorLog : undefined,
    hasTutorLog,
  };
}
