import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseIssueActionsProps {
  issueId: string;
  /**
   * Callback when opening in page (for dialogs, this should navigate and close).
   */
  onOpenInPage?: () => void;
}

/**
 * Hook that centralizes issue action handlers for ActionsMenu.
 * Use this in both dialogs and pages to keep actions in sync.
 */
export function useIssueActions({
  issueId,
  onOpenInPage,
}: UseIssueActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/issues/${issueId}`);
    }
  }, [issueId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
  };
}
