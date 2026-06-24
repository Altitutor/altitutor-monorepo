import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseTopicActionsProps {
  topicId: string;
  topic?: Tables<'topics'> | null;
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
 * Hook that centralizes topic action handlers for ActionsMenu.
 * Use this in both modals and pages/tables to keep actions in sync.
 */
export function useTopicActions({
  topicId,
  topic: _topic,
  onOpenInPage,
  onEdit,
  onDelete,
}: UseTopicActionsProps) {
  const router = useRouter();

  const handleOpenInPage = useCallback(() => {
    if (onOpenInPage) {
      onOpenInPage();
    } else if (topicId) {
      router.push(`/topics/${topicId}`);
    }
  }, [topicId, router, onOpenInPage]);

  return {
    onOpenInPage: handleOpenInPage,
    onEdit,
    onDelete,
  };
}
