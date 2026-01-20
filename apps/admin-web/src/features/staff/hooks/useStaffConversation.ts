import { useState, useEffect } from 'react';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';

interface UseStaffConversationProps {
  staffId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a staff member
 */
export function useStaffConversation({
  staffId,
  enabled = true,
}: UseStaffConversationProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !staffId) {
      setConversationId(null);
      return;
    }

    getExistingConversationForRelated(staffId, 'staff')
      .then((convId) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[useStaffConversation] Existing conversation ID for staff', staffId, ':', convId);
        }
        setConversationId(convId);
      })
      .catch((error) => {
        console.error('Failed to fetch conversation ID:', error);
        setConversationId(null);
      });
  }, [staffId, enabled]);

  return conversationId;
}
