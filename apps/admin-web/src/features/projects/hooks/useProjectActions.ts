import { usePaneNavigation } from '@/shared/hooks/usePaneNavigation';
import { useCallback } from 'react';

interface UseProjectActionsProps {
  projectId: string;
  /**
   * Callback when opening in page (for dialogs, this should navigate and close).
   */
  onOpenInPage?: () => void;
}

/**
 * Hook that centralizes project action handlers for ActionsMenu.
 * Use this in both dialogs and pages to keep actions in sync.
 */
export function useProjectActions({
  projectId,
  onOpenInPage,
}: UseProjectActionsProps) {
  const { router } = usePaneNavigation();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/projects/${projectId}`);
    }
  }, [projectId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
  };
}
