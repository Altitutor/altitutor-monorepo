/**
 * Centralized Attendance Status Derivation
 * 
 * This module provides a single source of truth for deriving attendance statuses
 * from raw session data. All attendance status logic should go through these functions.
 */

import { format } from 'date-fns';
import {
  type StudentAttendanceStatus,
  type StaffAttendanceStatus,
  type StudentPlannedStatus,
  type StudentActualStatus,
  type StaffPlannedStatus,
  type StaffActualStatus,
  STUDENT_PLANNED_STATUSES,
  STUDENT_ACTUAL_STATUSES,
  STAFF_PLANNED_STATUSES,
  STAFF_ACTUAL_STATUSES,
} from '../constants/attendanceStatuses';

// Re-export constants for convenience
export {
  STUDENT_PLANNED_STATUSES,
  STUDENT_ACTUAL_STATUSES,
  STAFF_PLANNED_STATUSES,
  STAFF_ACTUAL_STATUSES,
};

/**
 * Input types for student attendance derivation
 */
export type StudentAttendanceInput = {
  student_id?: string; // Student's ID (used for checking plannedStudentIds)
  sessions_students_id?: string | null;
  planned_absence?: boolean;
  is_extra?: boolean;
  was_trial?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  rescheduled_session?: {
    session?: {
      id: string;
      start_at?: string | null;
      class?: {
        start_time?: string | null;
      } | null;
    } | null;
  } | null;
  actual_attended?: boolean | null;
  actual_was_trial?: boolean | null;
};

/**
 * Input types for staff attendance derivation
 */
export type StaffAttendanceInput = {
  planned_absence?: boolean;
  is_swapped?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  actual_attended?: boolean | null;
  was_trial?: boolean; // For planned attendance
  actual_was_trial?: boolean | null; // For actual attendance
};

/**
 * Context for student attendance derivation
 */
export type StudentAttendanceContext = {
  hasTutorLog: boolean;
  plannedStudentIds: Set<string>;
};

/**
 * Context for staff attendance derivation
 */
export type StaffAttendanceContext = {
  hasTutorLog: boolean;
};

/**
 * Derive planned attendance status for a student
 */
export function deriveStudentPlannedStatus(
  input: StudentAttendanceInput,
  context: StudentAttendanceContext
): {
  status: StudentPlannedStatus;
  rescheduledSessionId: string;
  rescheduledDate: string;
} {
  const { plannedStudentIds } = context;
  const isUnplanned = (input.sessions_students_id === null || input.sessions_students_id === undefined) && input.is_extra;
  const wasTrialPlanned = input.was_trial ?? false;

  let status: StudentPlannedStatus = STUDENT_PLANNED_STATUSES.ATTENDING;
  let rescheduledSessionId = '';
  let rescheduledDate = '';

  if (input.planned_absence && !isUnplanned) {
    status = STUDENT_PLANNED_STATUSES.ABSENT;
    if (input.is_rescheduled && input.rescheduled_session?.session) {
      status = STUDENT_PLANNED_STATUSES.RESCHEDULED;
      rescheduledSessionId = input.rescheduled_session.session.id;
      if (input.rescheduled_session.session.start_at) {
        const startDate = new Date(input.rescheduled_session.session.start_at);
        const timeStr = input.rescheduled_session.session.class?.start_time || '';
        rescheduledDate = `${format(startDate, 'EEE dd/MM')} ${timeStr}`.trim();
      }
    } else if (input.is_credited) {
      status = STUDENT_PLANNED_STATUSES.CREDITED;
    }
  } else if (isUnplanned) {
    status = STUDENT_PLANNED_STATUSES.UNPLANNED;
  } else if (input.is_extra && input.student_id && plannedStudentIds.has(input.student_id)) {
    status = wasTrialPlanned
      ? STUDENT_PLANNED_STATUSES.ATTENDING_EXTRA_TRIAL
      : STUDENT_PLANNED_STATUSES.ATTENDING_EXTRA;
  } else {
    status = wasTrialPlanned
      ? STUDENT_PLANNED_STATUSES.ATTENDING_TRIAL
      : STUDENT_PLANNED_STATUSES.ATTENDING;
  }

  return { status, rescheduledSessionId, rescheduledDate };
}

/**
 * Derive actual attendance status for a student
 */
export function deriveStudentActualStatus(
  input: StudentAttendanceInput,
  context: StudentAttendanceContext
): StudentActualStatus {
  const { hasTutorLog } = context;

  if (!hasTutorLog) {
    return STUDENT_ACTUAL_STATUSES.NOT_LOGGED;
  }

  if (input.actual_attended === true) {
    const wasTrialActual = input.actual_was_trial ?? false;
    return wasTrialActual
      ? STUDENT_ACTUAL_STATUSES.ATTENDED_TRIAL
      : STUDENT_ACTUAL_STATUSES.ATTENDED;
  }

  return STUDENT_ACTUAL_STATUSES.DID_NOT_ATTEND;
}

/**
 * Derive complete student attendance status
 */
export function deriveStudentAttendanceStatus(
  input: StudentAttendanceInput,
  context: StudentAttendanceContext
): StudentAttendanceStatus {
  const planned = deriveStudentPlannedStatus(input, context);
  const actualStatus = deriveStudentActualStatus(input, context);

  return {
    plannedStatus: planned.status,
    actualStatus,
    rescheduledSessionId: planned.rescheduledSessionId,
    rescheduledDate: planned.rescheduledDate,
  };
}

/**
 * Derive planned attendance status for staff
 */
export function deriveStaffPlannedStatus(
  input: StaffAttendanceInput
): {
  status: StaffPlannedStatus;
  swappedStaffId: string;
  swappedStaffName: string;
} {
  const wasTrialPlanned = input.was_trial ?? false;
  let status: StaffPlannedStatus = wasTrialPlanned
    ? STAFF_PLANNED_STATUSES.ATTENDING_TRIAL
    : STAFF_PLANNED_STATUSES.ATTENDING;
  let swappedStaffId = '';
  let swappedStaffName = '';

  if (input.planned_absence) {
    status = STAFF_PLANNED_STATUSES.ABSENT;
    if (input.is_swapped && input.swapped_staff) {
      status = STAFF_PLANNED_STATUSES.SWAPPED;
      swappedStaffId = input.swapped_staff.id;
      swappedStaffName = `${input.swapped_staff.first_name} ${input.swapped_staff.last_name}`.trim();
    }
  }

  return { status, swappedStaffId, swappedStaffName };
}

/**
 * Derive actual attendance status for staff
 */
export function deriveStaffActualStatus(
  input: StaffAttendanceInput,
  context: StaffAttendanceContext
): StaffActualStatus {
  const { hasTutorLog } = context;

  if (!hasTutorLog) {
    return STAFF_ACTUAL_STATUSES.NOT_LOGGED;
  }

  if (input.actual_attended === true) {
    const wasTrialActual = input.actual_was_trial ?? false;
    return wasTrialActual
      ? STAFF_ACTUAL_STATUSES.ATTENDED_TRIAL
      : STAFF_ACTUAL_STATUSES.ATTENDED;
  }

  return STAFF_ACTUAL_STATUSES.DID_NOT_ATTEND;
}

/**
 * Derive complete staff attendance status
 */
export function deriveStaffAttendanceStatus(
  input: StaffAttendanceInput,
  context: StaffAttendanceContext
): StaffAttendanceStatus {
  const planned = deriveStaffPlannedStatus(input);
  const actualStatus = deriveStaffActualStatus(input, context);

  return {
    plannedStatus: planned.status,
    actualStatus,
    swappedStaffId: planned.swappedStaffId,
    swappedStaffName: planned.swappedStaffName,
  };
}

/**
 * Build student attendance map from tutor log
 * Maps student_id -> { attended: boolean, was_trial?: boolean }
 */
export function buildStudentAttendanceMap(
  tutorLog: {
    studentAttendance?: Array<{
      student_id: string;
      attended: boolean;
      was_trial?: boolean;
    }>;
  } | null | undefined
): Record<string, { attended: boolean; was_trial?: boolean }> {
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
 * Maps staff_id -> { attended: boolean, type?: string, was_trial?: boolean }
 */
export function buildStaffAttendanceMap(
  tutorLog: {
    staffAttendance?: Array<{
      staff_id: string;
      attended: boolean;
      type?: string;
      was_trial?: boolean;
    }>;
  } | null | undefined
): Record<string, { attended: boolean; type?: string; was_trial?: boolean }> {
  const attendance: Record<string, { attended: boolean; type?: string; was_trial?: boolean }> = {};
  
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att) => {
      const entry: { attended: boolean; type?: string; was_trial?: boolean } = {
        attended: att.attended,
      };
      if (att.type !== undefined) {
        entry.type = att.type;
      }
      if (att.was_trial !== undefined) {
        entry.was_trial = att.was_trial;
      }
      attendance[att.staff_id] = entry;
    });
  }
  
  return attendance;
}
