import { useConversationForRelated } from '@/features/messages/hooks/useConversationForRelated';

interface UseStaffConversationProps {
  staffId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a staff member.
 * Uses React Query for caching and request deduplication.
 */
export function useStaffConversation({
  staffId,
  enabled = true,
}: UseStaffConversationProps) {
  return useConversationForRelated(staffId, 'staff', enabled);
}
