'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCommunicationsStatsReportData } from '../api/hrReports';

export function useCommunicationsStatsReport(start: Date, end: Date) {
  return useQuery({
    queryKey: ['reports', 'communications', start.toISOString(), end.toISOString()],
    queryFn: () => fetchCommunicationsStatsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
