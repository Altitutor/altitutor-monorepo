import { useQuery } from '@tanstack/react-query';
import { fetchLastAdminMeetingDate } from '../api/lastAdminMeeting';
import { reportsKeys } from './useIssuesReport';

export function useLastAdminMeetingDate() {
  return useQuery({
    queryKey: [...reportsKeys.all, 'lastAdminMeetingDate'] as const,
    queryFn: () => fetchLastAdminMeetingDate(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}
