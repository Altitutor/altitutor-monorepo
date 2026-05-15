import type { SessionTableStudent, SessionTableStaff, StudentAttendanceStatus, StaffAttendanceStatus } from '../types/sessions-table';
import {
  deriveStudentAttendanceStatus,
  deriveStaffAttendanceStatus,
  type StudentAttendanceInput,
  type StaffAttendanceInput,
  type StudentAttendanceContext,
  type StaffAttendanceContext,
} from './attendanceDerivation';

/**
 * Derive planned/actual attendance status for a student in the sessions table.
 * This is a wrapper around the centralized derivation logic.
 */
export function getStudentAttendanceStatus(
  student: SessionTableStudent,
  hasTutorLog: boolean,
  plannedStudentIds: Set<string>
): StudentAttendanceStatus {
  const input: StudentAttendanceInput = {
    student_id: student.id,
    sessions_students_id: student.sessions_students_id,
    planned_absence: student.planned_absence,
    is_extra: student.is_extra,
    was_trial: student.was_trial,
    is_rescheduled: student.is_rescheduled,
    is_credited: student.is_credited,
    credited_at: student.absence_credited_at ?? null,
    rescheduled_session: student.rescheduled_session,
    actual_attended: student.actual_attended,
    actual_was_trial: student.actual_was_trial,
  };

  const context: StudentAttendanceContext = {
    hasTutorLog,
    plannedStudentIds,
  };

  return deriveStudentAttendanceStatus(input, context);
}

/**
 * Derive planned/actual attendance status for a staff member in the sessions table.
 * This is a wrapper around the centralized derivation logic.
 */
export function getStaffAttendanceStatus(
  staff: SessionTableStaff,
  hasTutorLog: boolean
): StaffAttendanceStatus {
  const input: StaffAttendanceInput = {
    planned_absence: staff.planned_absence,
    is_swapped: staff.is_swapped,
    swapped_staff: staff.swapped_staff,
    actual_attended: staff.actual_attended,
    was_trial: staff.was_trial,
    actual_was_trial: staff.actual_was_trial,
  };

  const context: StaffAttendanceContext = {
    hasTutorLog,
  };

  return deriveStaffAttendanceStatus(input, context);
}
