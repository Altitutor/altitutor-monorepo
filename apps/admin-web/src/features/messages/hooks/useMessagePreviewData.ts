import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import {
  fetchMessagePreviewData,
  type MessagePreviewRecipient,
  type MessagePreviewData,
} from '../api/bulk';

export const messagePreviewDataKeys = {
  all: ['message-preview-data'] as const,
  list: (studentIds: string[], sendToParents: boolean) =>
    [...messagePreviewDataKeys.all, studentIds.sort().join(','), sendToParents] as const,
};

interface UseMessagePreviewDataOptions {
  students: Tables<'students'>[];
  sendToParents: boolean;
  enabled?: boolean;
}

/**
 * React Query hook for bulk message preview recipients and student classes.
 * Replaces useEffect-based data fetching in MessagePreview component.
 */
export function useMessagePreviewData({
  students,
  sendToParents,
  enabled = true,
}: UseMessagePreviewDataOptions): {
  recipients: MessagePreviewRecipient[];
  studentClasses: Record<
    string,
    Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>
  >;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const studentIds = students.map((s) => s.id);

  const query = useQuery({
    queryKey: messagePreviewDataKeys.list(studentIds, sendToParents),
    queryFn: () => fetchMessagePreviewData(students, sendToParents),
    enabled: enabled && students.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });

  const data: MessagePreviewData = query.data ?? {
    recipients: [],
    studentClasses: {},
  };

  return {
    recipients: data.recipients,
    studentClasses: data.studentClasses,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
