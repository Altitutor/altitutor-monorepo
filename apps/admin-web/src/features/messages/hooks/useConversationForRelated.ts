import { useQuery } from '@tanstack/react-query';
import { getExistingConversationForRelated } from '../api/queries';
import { messagesKeys } from '../api/queryKeys';

/**
 * React Query hook to fetch existing conversation ID for a related entity (student/staff/parent).
 * Replaces useEffect-based fetching in useStudentConversation, useStaffConversation, useParentConversation.
 */
export function useConversationForRelated(
  relatedId: string | null,
  type: 'student' | 'staff' | 'parent',
  enabled = true
) {
  const query = useQuery({
    queryKey: messagesKeys.conversationForRelated(relatedId ?? '', type),
    queryFn: () => getExistingConversationForRelated(relatedId!, type),
    enabled: enabled && !!relatedId,
    staleTime: 1000 * 60 * 5, // 5 minutes - conversation ID is stable for a contact
  });

  return query.data ?? null;
}
