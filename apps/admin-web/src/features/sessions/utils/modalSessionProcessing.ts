import type { Tables } from '@altitutor/shared';
import { format } from 'date-fns';

export type ProcessedStudentSessionData = {
  session: Tables<'sessions'>;
  plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned';
  actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend';
  rescheduledDate: string;
  invoiceStatus: string | null;
};

export type ProcessedStaffSessionData = {
  session: Tables<'sessions'>;
  plannedStatus: 'attending' | 'absent' | 'swapped';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
  tutorLogSubmitted: boolean;
};

/**
 * Process session data for a specific student
 * This extracts the student's attendance and invoice info from session data
 */
export function processStudentSessionData(
  session: Tables<'sessions'>,
  sessionStudentData: Array<{
    id: string;
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    invoice_status?: string | null;
    sessions_students_id?: string;
    is_extra?: boolean;
    was_trial?: boolean;
    is_rescheduled?: boolean;
    is_credited?: boolean;
    rescheduled_session?: {
      session?: {
        id: string;
        start_at?: string;
        class?: {
          start_time?: string;
        };
      };
    };
  }>,
  studentId: string,
  hasTutorLog: boolean
): ProcessedStudentSessionData | null {
  // Find the student's data in this session
  const studentData = sessionStudentData.find((s) => s.id === studentId);
  if (!studentData) return null;

  const wasTrialPlanned = (studentData as any).was_trial ?? false;
  let plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
  let rescheduledDate = '';

  const isUnplanned = (studentData.sessions_students_id === null || studentData.sessions_students_id === undefined) && studentData.is_extra;

  if (studentData.planned_absence && !isUnplanned) {
    plannedStatus = 'absent';
    // Check for rescheduled/credited status if available
    if ((studentData as any).is_rescheduled && (studentData as any).rescheduled_session?.session) {
      plannedStatus = 'rescheduled';
      const resSession = (studentData as any).rescheduled_session.session;
      rescheduledDate = resSession.start_at
        ? `${format(new Date(resSession.start_at), 'EEE dd/MM')} ${resSession.class?.start_time || ''}`
        : '';
    } else if ((studentData as any).is_credited) {
      plannedStatus = 'credited';
    }
  } else if (isUnplanned) {
    plannedStatus = 'unplanned';
  } else if (studentData.is_extra) {
    plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
  } else {
    plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
  }

  // Compute actual status
  const actualAttended = studentData.actual_attended;
  const wasTrialActual = (studentData as any).was_trial_actual ?? wasTrialPlanned; // Infer from planned if actual not available
  let actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend' = !hasTutorLog
    ? 'not-logged'
    : actualAttended === true
    ? (wasTrialActual ? 'attended-trial' : 'attended')
    : 'did-not-attend';

  return {
    session,
    plannedStatus,
    actualStatus,
    rescheduledDate,
    invoiceStatus: studentData.invoice_status || null,
  };
}

/**
 * Process session data for a specific staff member
 */
export function processStaffSessionData(
  session: Tables<'sessions'>,
  sessionStaffData: Array<{
    id: string;
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    is_swapped_in?: boolean;
  }>,
  staffId: string,
  hasTutorLog: boolean,
  tutorLogCreatedBy?: string
): ProcessedStaffSessionData | null {
  // Find the staff member's data in this session
  const staffData = sessionStaffData.find((s) => s.id === staffId);
  if (!staffData) return null;

  let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';

  if (staffData.planned_absence) {
    // Check if there's a swapped-in staff member (someone else is covering)
    const hasSwappedStaff = sessionStaffData.some(
      (s) => s.id !== staffId && s.is_swapped_in === true
    );
    plannedStatus = hasSwappedStaff ? 'swapped' : 'absent';
  }

  // Compute actual status
  const actualAttended = staffData.actual_attended;
  const actualStatus: 'not-logged' | 'attended' | 'did-not-attend' = !hasTutorLog
    ? 'not-logged'
    : actualAttended === true
    ? 'attended'
    : 'did-not-attend';

  const tutorLogSubmitted = tutorLogCreatedBy === staffId;

  return {
    session,
    plannedStatus,
    actualStatus,
    tutorLogSubmitted,
  };
}
