import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek } from 'date-fns';
import { fetchIssuesReportData } from '../api/reports';

export const reportsKeys = {
  all: ['reports'] as const,
  issues: (weekStart: Date, weekEnd: Date) =>
    [...reportsKeys.all, 'issues', weekStart.toISOString(), weekEnd.toISOString()] as const,
};

export function useIssuesReport(weekStart?: Date, weekEnd?: Date) {
  const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = weekEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: reportsKeys.issues(start, end),
    queryFn: () => fetchIssuesReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
