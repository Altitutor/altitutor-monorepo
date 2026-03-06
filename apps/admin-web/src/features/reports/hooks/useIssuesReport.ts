import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek } from 'date-fns';
import {
  fetchIssuesReportData,
  fetchTasksReportData,
  fetchProjectsReportData,
} from '../api/reports';

export const reportsKeys = {
  all: ['reports'] as const,
  issues: (weekStart: Date, weekEnd: Date) =>
    [...reportsKeys.all, 'issues', weekStart.toISOString(), weekEnd.toISOString()] as const,
  tasks: (periodStart: Date, periodEnd: Date) =>
    [...reportsKeys.all, 'tasks', periodStart.toISOString(), periodEnd.toISOString()] as const,
  projects: (periodStart: Date, periodEnd: Date) =>
    [...reportsKeys.all, 'projects', periodStart.toISOString(), periodEnd.toISOString()] as const,
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

export function useTasksReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: reportsKeys.tasks(start, end),
    queryFn: () => fetchTasksReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export function useProjectsReport(periodStart?: Date, periodEnd?: Date) {
  const start = periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 });

  return useQuery({
    queryKey: reportsKeys.projects(start, end),
    queryFn: () => fetchProjectsReportData(start, end),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
