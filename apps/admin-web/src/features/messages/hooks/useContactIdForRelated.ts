import { useQuery } from '@tanstack/react-query';
import { getContactIdByRelatedId } from '../api/queries';
import { messagesKeys } from '../api/queryKeys';

/**
 * React Query hook to fetch contact ID from a related entity (student/staff/parent).
 * Replaces useEffect-based getContactIdByRelatedId calls in invite dialogs.
 */
export function useContactIdForRelated(
  relatedId: string | undefined,
  type: 'student' | 'staff' | 'parent',
  enabled: boolean
) {
  return useQuery({
    queryKey: messagesKeys.contactId(relatedId ?? '', type),
    queryFn: () => getContactIdByRelatedId(relatedId!, type),
    enabled: enabled && !!relatedId,
    staleTime: 1000 * 60 * 5, // 5 minutes - contact IDs are stable
  });
}
