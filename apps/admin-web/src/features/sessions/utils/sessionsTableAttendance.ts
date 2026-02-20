import { format } from 'date-fns';
import type { SessionTableStudent, SessionTableStaff, StudentAttendanceStatus, StaffAttendanceStatus } from '../types/sessions-table';

/**
 * Derive planned/actual attendance status for a student in the sessions table.
 */
export function getStudentAttendanceStatus(
  student: SessionTableStudent,
  hasTutorLog: boolean,
  plannedStudentIds: Set<string>
): StudentAttendanceStatus {
  const isUnplanned = (student.sessions_students_id === null || student.sessions_students_id === undefined) && student.is_extra;
  const wasTrialPlanned = student.was_trial ?? false;

  let plannedStatus: StudentAttendanceStatus['plannedStatus'] = 'attending';
  let rescheduledSessionId = '';
  let rescheduledDate = '';

  if (student.planned_absence && !isUnplanned) {
    plannedStatus = 'absent';
    if (student.is_rescheduled && student.rescheduled_session?.session) {
      plannedStatus = 'rescheduled';
      rescheduledSessionId = student.rescheduled_session.session.id;
      if (student.rescheduled_session.session.start_at) {
        rescheduledDate = `${format(new Date(student.rescheduled_session.session.start_at), 'EEE dd/MM')} ${student.rescheduled_session.session.class?.start_time || ''}`.trim();
      }
    } else if (student.is_credited) {
      plannedStatus = 'credited';
    }
  } else if (isUnplanned) {
    plannedStatus = 'unplanned';
  } else if (student.is_extra && plannedStudentIds.has(student.id)) {
    plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
  } else {
    plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
  }

  const wasTrialActual = student.actual_was_trial ?? false;
  const actualStatus: StudentAttendanceStatus['actualStatus'] = !hasTutorLog
    ? 'not-logged'
    : student.actual_attended
      ? (wasTrialActual ? 'attended-trial' : 'attended')
      : 'did-not-attend';

  return {
    plannedStatus,
    actualStatus,
    rescheduledSessionId,
    rescheduledDate,
  };
}

/**
 * Derive planned/actual attendance status for a staff member in the sessions table.
 */
export function getStaffAttendanceStatus(staff: SessionTableStaff, hasTutorLog: boolean): StaffAttendanceStatus {
  let plannedStatus: StaffAttendanceStatus['plannedStatus'] = 'attending';
  let swappedStaffId = '';
  let swappedStaffName = '';

  if (staff.planned_absence) {
    plannedStatus = 'absent';
    if (staff.is_swapped && staff.swapped_staff) {
      plannedStatus = 'swapped';
      swappedStaffId = staff.swapped_staff.id;
      swappedStaffName = `${staff.swapped_staff.first_name} ${staff.swapped_staff.last_name}`.trim();
    }
  }

  const actualStatus: StaffAttendanceStatus['actualStatus'] = !hasTutorLog
    ? 'not-logged'
    : staff.actual_attended
      ? 'attended'
      : 'did-not-attend';

  return {
    plannedStatus,
    actualStatus,
    swappedStaffId,
    swappedStaffName,
  };
}
