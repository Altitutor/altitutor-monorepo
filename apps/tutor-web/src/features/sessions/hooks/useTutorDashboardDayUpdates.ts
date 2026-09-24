import { useMemo } from 'react';
import { useClassesWithDetailsBatch } from '@/features/classes/hooks/useClassesQuery';
import {
  useTutorSessionDetailsBatch,
  useTutorSessionsInRange,
  useTutorSessionsOriginallyInRange,
} from './useSessionsQuery';
import {
  parseClassEnrolledStudentIds,
  parseClassStaffIds,
  readOptionalIso,
} from '../utils/parseSessionDetailJson';
import {
  buildDashboardDayUpdates,
  type DashboardClassStaffAssignment,
  type DashboardDaySession,
  type DashboardDayStaff,
  type DashboardDayStudent,
  type DashboardDayUpdates,
} from '../utils/dashboardDayUpdates';
import type { Database } from '@altitutor/shared';

type TutorSessionRow = Database['public']['Views']['vtutor_sessions']['Row'];

function toDashboardSession(row: TutorSessionRow, classShortName?: string | null): DashboardDaySession | null {
  if (!row.session_id) return null;
  return {
    id: row.session_id,
    type: row.session_type,
    class_id: row.class_id,
    start_at: row.start_at,
    end_at: row.end_at,
    original_start_at: readOptionalIso(row, 'original_start_at'),
    original_end_at: readOptionalIso(row, 'original_end_at'),
    short_name: readOptionalIso(row, 'short_name') ?? classShortName ?? null,
    long_name: readOptionalIso(row, 'long_name'),
  };
}

export function useTutorDashboardDayUpdates(date: string) {
  const sessionsQuery = useTutorSessionsInRange(date, date);
  const originalQuery = useTutorSessionsOriginallyInRange(date, date);

  const sessionRows = useMemo(() => {
    const byId = new Map<string, TutorSessionRow>();
    for (const row of [...(sessionsQuery.data ?? []), ...(originalQuery.data ?? [])]) {
      if (row.session_id) byId.set(row.session_id, row);
    }
    return [...byId.values()];
  }, [originalQuery.data, sessionsQuery.data]);

  const sessionIds = useMemo(
    () => sessionRows.map((row) => row.session_id).filter((id): id is string => Boolean(id)),
    [sessionRows]
  );
  const classIds = useMemo(
    () => [...new Set(sessionRows.map((row) => row.class_id).filter((id): id is string => Boolean(id)))],
    [sessionRows]
  );

  const detailsQuery = useTutorSessionDetailsBatch(sessionIds);
  const classesQuery = useClassesWithDetailsBatch(classIds);
  const detailsMap = detailsQuery.data;
  const classRows = classesQuery.data;

  const updates: DashboardDayUpdates = useMemo(() => {
    const classShortById = new Map<string, string>();
    const enrolledByClass = new Map<string, Set<string>>();
    const assignments: DashboardClassStaffAssignment[] = [];

    for (const classRow of classRows ?? []) {
      if (!classRow.class_id) continue;
      if (classRow.short_name?.trim()) classShortById.set(classRow.class_id, classRow.short_name.trim());
      enrolledByClass.set(classRow.class_id, new Set(parseClassEnrolledStudentIds(classRow.students)));
      for (const staffId of parseClassStaffIds(classRow.staff)) {
        assignments.push({
          class_id: classRow.class_id,
          staff_id: staffId,
          assigned_at: '1970-01-01T00:00:00.000Z',
          unassigned_at: null,
        });
      }
    }

    const sessions: DashboardDaySession[] = [];
    const sessionStudents: Record<string, DashboardDayStudent[]> = {};
    const sessionStaff: Record<string, DashboardDayStaff[]> = {};
    const sessionParents: Record<string, NonNullable<typeof detailsMap>[string]['parents']> = {};

    for (const row of sessionRows) {
      const mapped = toDashboardSession(row, row.class_id ? classShortById.get(row.class_id) : null);
      if (!mapped) continue;
      sessions.push(mapped);

      const details = detailsMap?.[mapped.id];
      const enrolledIds = mapped.class_id ? enrolledByClass.get(mapped.class_id) : undefined;
      sessionStudents[mapped.id] = (details?.students ?? []).map((student) => ({
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        planned_absence: student.planned_absence,
        sessions_students_id: student.session_student_id ?? null,
        is_extra:
          student.is_extra ??
          (enrolledIds != null && enrolledIds.size > 0 ? !enrolledIds.has(student.id) : undefined),
      }));
      sessionStaff[mapped.id] = details?.staff ?? [];
      sessionParents[mapped.id] = details?.parents ?? [];
    }

    return buildDashboardDayUpdates({
      sessions,
      sessionStudents,
      sessionStaff,
      sessionParents,
      classStaffAssignments: assignments,
      viewDate: date,
    });
  }, [classRows, date, detailsMap, sessionRows]);

  const isDetailsLoading = sessionIds.length > 0 && detailsQuery.isLoading;
  const isClassesLoading = classIds.length > 0 && classesQuery.isLoading;

  return {
    updates,
    isLoading: sessionsQuery.isLoading || originalQuery.isLoading || isDetailsLoading || isClassesLoading,
    isError: sessionsQuery.isError || detailsQuery.isError,
  };
}
