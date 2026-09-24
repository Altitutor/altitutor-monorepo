import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';
import { useSessionsWithDetails, sessionsKeys } from './useSessionsQuery';
import {
  buildDashboardDayUpdates,
  DASHBOARD_MEETING_TYPES,
  type DashboardDaySession,
  type DashboardDayUpdates,
} from '../utils/dashboardDayUpdates';

const MEETING_TYPE_SET = new Set<string>(DASHBOARD_MEETING_TYPES);

export function useDashboardDayUpdates(date: string) {
  const sessionsQuery = useSessionsWithDetails({
    rangeStart: date,
    rangeEnd: date,
    includeInactive: false,
  });

  const overridesQuery = useQuery({
    queryKey: [...sessionsKeys.withDetails(), 'schedule-overrides', date],
    queryFn: () => sessionsApi.getSessionScheduleOverrides(date, date),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 3,
  });

  const meetingIds = useMemo(
    () =>
      (sessionsQuery.data?.sessions ?? [])
        .filter((row) => MEETING_TYPE_SET.has(row.type))
        .map((row) => row.id)
        .sort(),
    [sessionsQuery.data?.sessions]
  );

  const parentsQuery = useQuery({
    queryKey: [...sessionsKeys.withDetails(), 'session-parents', date, meetingIds],
    queryFn: () => sessionsApi.getSessionParents(meetingIds),
    enabled: meetingIds.length > 0,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 3,
  });

  const classIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of sessionsQuery.data?.sessions ?? []) {
      if (session.class_id) ids.add(session.class_id);
    }
    return [...ids].sort();
  }, [sessionsQuery.data?.sessions]);

  const assignmentsQuery = useQuery({
    queryKey: [...sessionsKeys.withDetails(), 'class-staff', date, classIds],
    queryFn: () => sessionsApi.getClassStaffAssignments(classIds),
    enabled: classIds.length > 0,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 3,
  });

  const updates: DashboardDayUpdates = useMemo(() => {
    const sessionsById = new Map<string, DashboardDaySession>();

    for (const row of sessionsQuery.data?.sessions ?? []) {
      sessionsById.set(row.id, {
        id: row.id,
        type: row.type,
        class_id: row.class_id,
        start_at: row.start_at,
        end_at: row.end_at,
        original_start_at: row.original_start_at,
        original_end_at: row.original_end_at,
        short_name: row.short_name,
        long_name: row.long_name,
      });
    }

    for (const override of overridesQuery.data ?? []) {
      const existing = sessionsById.get(override.id);
      sessionsById.set(override.id, {
        id: override.id,
        type: override.type ?? existing?.type ?? null,
        class_id: override.class_id ?? existing?.class_id ?? null,
        start_at: override.start_at ?? existing?.start_at ?? null,
        end_at: override.end_at ?? existing?.end_at ?? null,
        original_start_at: override.original_start_at ?? existing?.original_start_at,
        original_end_at: override.original_end_at ?? existing?.original_end_at,
        short_name: override.short_name ?? existing?.short_name,
        long_name: override.long_name ?? existing?.long_name,
      });
    }

    return buildDashboardDayUpdates({
      sessions: [...sessionsById.values()],
      sessionStudents: sessionsQuery.data?.sessionStudents ?? {},
      sessionStaff: sessionsQuery.data?.sessionStaff ?? {},
      sessionParents: parentsQuery.data ?? {},
      classesById: sessionsQuery.data?.classesById ?? {},
      subjectsById: sessionsQuery.data?.subjectsById ?? {},
      classStaffAssignments: assignmentsQuery.data ?? [],
      viewDate: date,
    });
  }, [
    assignmentsQuery.data,
    date,
    overridesQuery.data,
    parentsQuery.data,
    sessionsQuery.data?.classesById,
    sessionsQuery.data?.sessionStaff,
    sessionsQuery.data?.sessionStudents,
    sessionsQuery.data?.sessions,
    sessionsQuery.data?.subjectsById,
  ]);

  const isAssignmentsLoading = classIds.length > 0 && assignmentsQuery.isLoading;
  const isParentsLoading = meetingIds.length > 0 && parentsQuery.isLoading;

  return {
    updates,
    isLoading:
      sessionsQuery.isLoading || overridesQuery.isLoading || isAssignmentsLoading || isParentsLoading,
    isError: sessionsQuery.isError,
  };
}
