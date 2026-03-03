'use client';

import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek } from 'date-fns';
import {
  fetchBillingStatsReportData,
  fetchMarketingStatsReportData,
  fetchStaffAbsencesReportData,
  fetchStudentStatsReportData,
} from '../api/reports';

export const additionalReportsKeys = {
  staff: (start: Date, end: Date) =>
    ['reports', 'staff', start.toISOString(), end.toISOString()] as const,
  students: (start: Date, end: Date) =>
    ['reports', 'students', start.toISOString(), end.toISOString()] as const,
  marketing: (start: Date, end: Date) =>
    ['reports', 'marketing', start.toISOString(), end.toISOString()] as const,
  billing: (start: Date, end: Date) =>
    ['reports', 'billing', start.toISOString(), end.toISOString()] as const,
};

export function useStaffAbsencesReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: additionalReportsKeys.staff(start, end),
    queryFn: () => fetchStaffAbsencesReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export function useStudentStatsReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: additionalReportsKeys.students(start, end),
    queryFn: () => fetchStudentStatsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export function useMarketingStatsReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: additionalReportsKeys.marketing(start, end),
    queryFn: () => fetchMarketingStatsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export function useBillingStatsReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: additionalReportsKeys.billing(start, end),
    queryFn: () => fetchBillingStatsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

