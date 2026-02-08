import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseSubjectActionsProps {
  subjectId: string;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
  /**
   * Optional callback for edit action
   */
  onEdit?: () => void;
  /**
   * Optional callback for delete action
   */
  onDelete?: () => void;
}

/**
 * Hook that centralizes subject action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useSubjectActions({
  subjectId,
  onOpenInPage,
  onEdit,
  onDelete,
}: UseSubjectActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/subjects/${subjectId}`);
    }
  }, [subjectId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onEdit,
    onDelete,
  };
}
