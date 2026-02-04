import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';

export type ProcessedStudentData = {
  student: Tables<'students'>;
  plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' | 'attending-trial' | 'attending-extra-trial';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend' | 'attended-trial';
  rescheduledDate: string;
  rescheduledSessionId?: string;
  invoiceStatus: string | null;
  plannedAbsence: boolean;
  hasInvoiceItems: boolean;
};

export type ProcessedStaffData = {
  staff: Tables<'staff'>;
  plannedStatus: 'attending' | 'absent' | 'swapped';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
  staffType?: string;
  swappedStaffName: string;
  swappedStaffId: string;
  submittedTutorLog: boolean;
  plannedAbsence: boolean;
};

/**
 * Build student attendance map from tutor log
 */
export function buildStudentAttendanceMap(tutorLog: any): Record<string, { attended: boolean; was_trial?: boolean }> {
  const attendance: Record<string, { attended: boolean; was_trial?: boolean }> = {};
  if (tutorLog?.studentAttendance) {
    tutorLog.studentAttendance.forEach((att: any) => {
      attendance[att.student_id] = { 
        attended: att.attended,
        was_trial: att.was_trial ?? false
      };
    });
  }
  return attendance;
}

/**
 * Build staff attendance map from tutor log
 */
export function buildStaffAttendanceMap(tutorLog: any): Record<string, { attended: boolean; type?: string }> {
  const attendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att: any) => {
      attendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }
  return attendance;
}

/**
 * Process session students data
 */
export function processSessionStudents(
  sessionsStudents: any[],
  actualStudentAttendance: Record<string, { attended: boolean; was_trial?: boolean }>,
  hasTutorLog: boolean
): ProcessedStudentData[] {
  // Build set of student IDs that are in sessions_students (planned students)
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss: any) => ss.student_id && (ss.sessions_students_id !== null && ss.sessions_students_id !== undefined))
      .map((ss: any) => ss.student_id)
  );

  return sessionsStudents.map((ss: any) => {
    const wasTrialPlanned = ss.was_trial ?? false;
    let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' | 'attending-trial' | 'attending-extra-trial' = 'attending';
    let rescheduledDate = '';

    const isUnplanned = (ss.sessions_students_id === null || ss.sessions_students_id === undefined) && ss.is_extra;

    if (ss.planned_absence && !isUnplanned) {
      plannedStatus = 'absent';
      if (ss.is_rescheduled && ss.rescheduled_session?.session) {
        plannedStatus = 'rescheduled';
        const resSession = ss.rescheduled_session.session;
        rescheduledDate = resSession.start_at
          ? `${format(new Date(resSession.start_at), 'EEE dd/MM')} ${resSession.class?.start_time || ''}`
          : '';
      } else if (ss.is_credited) {
        plannedStatus = 'credited';
      }
    } else if (isUnplanned) {
      plannedStatus = 'unplanned';
    } else if (ss.is_extra && plannedStudentIds.has(ss.student_id)) {
      plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
    } else {
      plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
    }

    const actualAttendance = actualStudentAttendance[ss.student_id];
    const wasTrialActual = actualAttendance?.was_trial ?? false;
    let actualStatus: 'not-logged' | 'attended' | 'did-not-attend' | 'attended-trial' = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? (wasTrialActual ? 'attended-trial' : 'attended')
      : 'did-not-attend';

    return {
      student: ss.student,
      plannedStatus,
      actualStatus,
      rescheduledDate,
      rescheduledSessionId: ss.rescheduled_session?.session?.id,
      invoiceStatus: ss.invoice_status || null,
      plannedAbsence: ss.planned_absence || false,
      hasInvoiceItems: !!ss.invoice_status,
    };
  });
}

/**
 * Process session staff data
 */
export function processSessionStaff(
  sessionsStaff: any[],
  actualStaffAttendance: Record<string, { attended: boolean; type?: string }>,
  hasTutorLog: boolean,
  tutorLogCreatedBy?: string
): ProcessedStaffData[] {
  return sessionsStaff.map((sf: any) => {
    let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';
    let swappedStaffName = '';
    let swappedStaffId = '';

    if (sf.planned_absence) {
      plannedStatus = 'absent';
      if (sf.is_swapped && sf.swapped_staff) {
        plannedStatus = 'swapped';
        swappedStaffName = `${sf.swapped_staff.first_name} ${sf.swapped_staff.last_name}`;
        swappedStaffId = sf.swapped_staff.id;
      }
    }

    const actualAttendance = actualStaffAttendance[sf.staff_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';

    const submittedTutorLog = tutorLogCreatedBy === sf.staff_id;

    return {
      staff: sf.staff,
      plannedStatus,
      actualStatus,
      staffType: actualAttendance?.type,
      swappedStaffName,
      swappedStaffId,
      submittedTutorLog,
      plannedAbsence: sf.planned_absence || false,
    };
  });
}
