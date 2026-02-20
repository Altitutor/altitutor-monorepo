import { useConversationForRelated } from '@/features/messages/hooks/useConversationForRelated';

interface UseParentConversationProps {
  parentId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a parent.
 * Uses React Query for caching and request deduplication.
 */
export function useParentConversation({
  parentId,
  enabled = true,
}: UseParentConversationProps) {
  return useConversationForRelated(parentId, 'parent', enabled);
}
