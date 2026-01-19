import { useState, useEffect } from 'react';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';

interface UseStudentConversationProps {
  studentId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a student
 */
export function useStudentConversation({
  studentId,
  enabled = true,
}: UseStudentConversationProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !studentId) {
      setConversationId(null);
      return;
    }

    getExistingConversationForRelated(studentId, 'student')
      .then((convId) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[useStudentConversation] Existing conversation ID for student', studentId, ':', convId);
        }
        setConversationId(convId);
      })
      .catch((error) => {
        console.error('Failed to fetch conversation ID:', error);
        setConversationId(null);
      });
  }, [studentId, enabled]);

  return conversationId;
}
