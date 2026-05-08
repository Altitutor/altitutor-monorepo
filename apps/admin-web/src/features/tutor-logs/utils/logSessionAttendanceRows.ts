import type { Tables } from '@altitutor/shared';
import type { SessionForLogging } from '../hooks/useSessionForLogging';
import type { SessionStudentItem, SessionStaffItem } from '@/features/sessions/utils/sessionDataProcessing';
import type { StudentAttendanceItem } from '../hooks/useStudentAttendance';

/** Placeholder so draft-only extras get planned "Attending (extra)" (not "Unplanned") in `processSessionStudents`. */
export const TUTOR_LOG_DRAFT_SESSIONS_STUDENTS_ID = '__tutor_log_draft_student__';

function asStaffRow(s: SessionForLogging['staff'][number]): Tables<'staff'> {
  return s as unknown as Tables<'staff'>;
}

/**
 * Build session-student rows for `processSessionStudents` (same shape as session modal).
 * Includes roster students plus any extra students already present in the tutor-log draft.
 */
export function buildSessionStudentItemsForTutorLog(
  roster: SessionForLogging['students'],
  studentAttendance: StudentAttendanceItem[],
  allStudents: Tables<'students'>[]
): SessionStudentItem[] {
  const rosterItems: SessionStudentItem[] = roster.map((s) => ({
    student_id: s.id,
    student: s as Tables<'students'>,
    sessions_students_id: s.sessions_students_id ?? null,
    rescheduled_sessions_students_id: s.rescheduled_sessions_students_id ?? null,
    planned_absence: s.planned_absence ?? false,
    is_extra: s.is_extra ?? false,
    was_trial: s.session_was_trial ?? false,
    is_rescheduled: s.session_is_rescheduled ?? false,
    is_credited: s.session_is_credited ?? false,
    rescheduled_session: null,
    invoice_status_payload: null,
  }));

  const rosterIds = new Set(roster.map((x) => x.id));
  const extras: SessionStudentItem[] = [];

  for (const row of studentAttendance) {
    if (rosterIds.has(row.studentId)) continue;
    const st = allStudents.find((x) => x.id === row.studentId);
    if (!st) continue;
    extras.push({
      student_id: st.id,
      student: st,
      sessions_students_id: TUTOR_LOG_DRAFT_SESSIONS_STUDENTS_ID,
      rescheduled_sessions_students_id: null,
      planned_absence: false,
      is_extra: true,
      was_trial: false,
      is_rescheduled: false,
      is_credited: false,
      rescheduled_session: null,
      invoice_status_payload: null,
    });
  }

  return [...rosterItems, ...extras];
}

export function buildStaffSessionItemsForTutorLog(roster: SessionForLogging['staff']): SessionStaffItem[] {
  return roster.map((s) => ({
    id: s.sessions_staff_id ?? undefined,
    staff_id: s.id,
    staff: asStaffRow(s),
    planned_absence: s.planned_absence,
    was_trial: s.session_was_trial ?? false,
    is_swapped: s.is_swapped ?? false,
    swapped_sessions_staff_id: s.swapped_sessions_staff_id ?? null,
    swapped_staff: s.swapped_staff ?? null,
  }));
}
