import { useConversationForRelated } from '@/features/messages/hooks/useConversationForRelated';

interface UseStudentConversationProps {
  studentId: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching conversation ID for a student.
 * Uses React Query for caching and request deduplication.
 */
export function useStudentConversation({
  studentId,
  enabled = true,
}: UseStudentConversationProps) {
  return useConversationForRelated(studentId, 'student', enabled);
}
