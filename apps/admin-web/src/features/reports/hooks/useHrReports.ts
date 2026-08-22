'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchHrStatsReportData } from '../api/hrReports';

export function useHrStatsReport(start: Date, end: Date) {
  return useQuery({
    queryKey: ['reports', 'hr', start.toISOString(), end.toISOString()],
    queryFn: () => fetchHrStatsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

