import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseTaskActionsProps {
  taskId: string;
  /**
   * Callback when opening in page (for dialogs, this should navigate and close).
   */
  onOpenInPage?: () => void;
}

/**
 * Hook that centralizes task action handlers for ActionsMenu.
 * Use this in both dialogs and pages to keep actions in sync.
 */
export function useTaskActions({
  taskId,
  onOpenInPage,
}: UseTaskActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/tasks/${taskId}`);
    }
  }, [taskId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
  };
}
