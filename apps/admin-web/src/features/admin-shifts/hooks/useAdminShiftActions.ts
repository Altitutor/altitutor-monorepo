import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UseAdminShiftActionsProps {
  adminShiftId: string;
  /**
   * Callback when opening in page (for modals, this should close the modal)
   */
  onOpenInPage?: () => void;
}

/**
 * Hook that centralizes admin shift action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useAdminShiftActions({
  adminShiftId,
  onOpenInPage,
}: UseAdminShiftActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else {
      router.push(`/admin-shifts/${adminShiftId}`);
    }
  }, [adminShiftId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
  };
}
