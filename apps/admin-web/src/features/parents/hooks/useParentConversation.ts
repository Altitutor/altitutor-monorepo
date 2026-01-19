import { useState, useEffect } from 'react';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';

interface UseParentConversationProps {
  parentId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a parent
 */
export function useParentConversation({
  parentId,
  enabled = true,
}: UseParentConversationProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !parentId) {
      setConversationId(null);
      return;
    }

    getExistingConversationForRelated(parentId, 'parent')
      .then((convId) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[useParentConversation] Existing conversation ID for parent', parentId, ':', convId);
        }
        setConversationId(convId);
      })
      .catch((error) => {
        console.error('Failed to fetch conversation ID:', error);
        setConversationId(null);
      });
  }, [parentId, enabled]);

  return conversationId;
}
