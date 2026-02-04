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

type TutorLogStudentAttendance = {
  student_id: string;
  attended: boolean;
  was_trial?: boolean;
};

type TutorLogStaffAttendance = {
  staff_id: string;
  attended: boolean;
  type?: string;
};

type TutorLogWithAttendance = {
  studentAttendance?: TutorLogStudentAttendance[];
  staffAttendance?: TutorLogStaffAttendance[];
};

type SessionStudentItem = {
  student_id: string;
  student: Tables<'students'>;
  sessions_students_id?: string | null;
  planned_absence?: boolean;
  is_extra?: boolean;
  was_trial?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  invoice_status?: string | null;
  rescheduled_session?: {
    session?: {
      id: string;
      start_at?: string;
      class?: {
        start_time?: string;
      };
    };
  };
};

type SessionStaffItem = {
  staff_id: string;
  staff: Tables<'staff'>;
  planned_absence?: boolean;
  is_swapped?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

/**
 * Build student attendance map from tutor log
 */
export function buildStudentAttendanceMap(tutorLog: TutorLogWithAttendance | null | undefined): Record<string, { attended: boolean; was_trial?: boolean }> {
  const attendance: Record<string, { attended: boolean; was_trial?: boolean }> = {};
  if (tutorLog?.studentAttendance) {
    tutorLog.studentAttendance.forEach((att) => {
      const entry: { attended: boolean; was_trial?: boolean } = {
        attended: att.attended,
      };
      if (att.was_trial !== undefined) {
        entry.was_trial = att.was_trial;
      }
      attendance[att.student_id] = entry;
    });
  }
  return attendance;
}

/**
 * Build staff attendance map from tutor log
 */
export function buildStaffAttendanceMap(tutorLog: TutorLogWithAttendance | null | undefined): Record<string, { attended: boolean; type?: string }> {
  const attendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att) => {
      attendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }
  return attendance;
}

/**
 * Process session students data
 */
export function processSessionStudents(
  sessionsStudents: SessionStudentItem[],
  actualStudentAttendance: Record<string, { attended: boolean; was_trial?: boolean }>,
  hasTutorLog: boolean
): ProcessedStudentData[] {
  // Build set of student IDs that are in sessions_students (planned students)
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss) => ss.student_id && (ss.sessions_students_id !== null && ss.sessions_students_id !== undefined))
      .map((ss) => ss.student_id)
  );

  return sessionsStudents.map((ss) => {
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
    const actualStatus: 'not-logged' | 'attended' | 'did-not-attend' | 'attended-trial' = !hasTutorLog
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
  sessionsStaff: SessionStaffItem[],
  actualStaffAttendance: Record<string, { attended: boolean; type?: string }>,
  hasTutorLog: boolean,
  tutorLogCreatedBy?: string
): ProcessedStaffData[] {
  return sessionsStaff.map((sf) => {
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
