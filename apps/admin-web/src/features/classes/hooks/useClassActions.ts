import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseClassActionsProps {
  classId: string;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
  /**
   * Callback when delete is clicked - typically opens delete confirmation dialog
   */
  onDelete?: () => void;
}

/**
 * Hook that centralizes class action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useClassActions({
  classId,
  onOpenInPage,
  onDelete,
}: UseClassActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/classes/${classId}`);
    }
  }, [classId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onDelete,
  };
}
