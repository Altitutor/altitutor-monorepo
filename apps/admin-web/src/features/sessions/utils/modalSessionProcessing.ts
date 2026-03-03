import type { Tables } from '@altitutor/shared';
import type {
  StudentPlannedStatus,
  StudentActualStatus,
  StaffPlannedStatus,
  StaffActualStatus,
} from '../constants/attendanceStatuses';
import {
  deriveStudentAttendanceStatus,
  deriveStaffAttendanceStatus,
  type StudentAttendanceInput,
  type StaffAttendanceInput,
  type StudentAttendanceContext,
  type StaffAttendanceContext,
} from './attendanceDerivation';

export type ProcessedStudentSessionData = {
  session: Tables<'sessions'>;
  plannedStatus: StudentPlannedStatus;
  actualStatus: StudentActualStatus;
  rescheduledDate: string;
  invoiceStatus: string | null;
};

export type ProcessedStaffSessionData = {
  session: Tables<'sessions'>;
  plannedStatus: StaffPlannedStatus;
  actualStatus: StaffActualStatus;
  tutorLogSubmitted: boolean;
};

/**
 * Process session data for a specific student
 * This extracts the student's attendance and invoice info from session data
 */
type SessionStudentDataItem = {
  id: string;
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  invoice_status?: string | null;
  sessions_students_id?: string | null;
  is_extra?: boolean;
  was_trial?: boolean;
  was_trial_actual?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  rescheduled_session?: unknown;
};

export function processStudentSessionData(
  session: Tables<'sessions'>,
  sessionStudentData: Array<SessionStudentDataItem>,
  studentId: string,
  hasTutorLog: boolean
): ProcessedStudentSessionData | null {
  // Find the student's data in this session
  const studentData = sessionStudentData.find((s) => s.id === studentId);
  if (!studentData) return null;

  // Build input for centralized derivation
  // Note: For modal processing, we need to infer plannedStudentIds from the data
  // Since we're processing a single student, we'll use an empty set for plannedStudentIds
  // This means extra students won't be marked as "attending-extra" in modal context
  const input: StudentAttendanceInput = {
    student_id: studentId,
    sessions_students_id: studentData.sessions_students_id ?? undefined,
    planned_absence: studentData.planned_absence,
    is_extra: studentData.is_extra,
    was_trial: studentData.was_trial,
    is_rescheduled: studentData.is_rescheduled,
    is_credited: studentData.is_credited,
    rescheduled_session: studentData.rescheduled_session as StudentAttendanceInput['rescheduled_session'],
    actual_attended: studentData.actual_attended,
    actual_was_trial: studentData.was_trial_actual ?? studentData.was_trial, // Infer from planned if actual not available
  };

  const context: StudentAttendanceContext = {
    hasTutorLog,
    plannedStudentIds: new Set(), // Empty set for modal context - extra status won't apply
  };

  const attendanceStatus = deriveStudentAttendanceStatus(input, context);

  return {
    session,
    plannedStatus: attendanceStatus.plannedStatus,
    actualStatus: attendanceStatus.actualStatus,
    rescheduledDate: attendanceStatus.rescheduledDate,
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
    actual_was_trial?: boolean | null;
    was_trial?: boolean;
    is_swapped_in?: boolean;
  }>,
  staffId: string,
  hasTutorLog: boolean,
  tutorLogCreatedBy?: string
): ProcessedStaffSessionData | null {
  // Find the staff member's data in this session
  const staffData = sessionStaffData.find((s) => s.id === staffId);
  if (!staffData) return null;

  // Check if there's a swapped-in staff member (someone else is covering)
  const hasSwappedStaff = sessionStaffData.some(
    (s) => s.id !== staffId && s.is_swapped_in === true
  );

  const input: StaffAttendanceInput = {
    planned_absence: staffData.planned_absence,
    is_swapped: hasSwappedStaff,
    swapped_staff: null, // Modal context doesn't have swapped_staff details
    was_trial: staffData.was_trial,
    actual_attended: staffData.actual_attended,
    actual_was_trial: staffData.actual_was_trial,
  };

  const context: StaffAttendanceContext = {
    hasTutorLog,
  };

  const attendanceStatus = deriveStaffAttendanceStatus(input, context);

  const tutorLogSubmitted = tutorLogCreatedBy === staffId;

  return {
    session,
    plannedStatus: attendanceStatus.plannedStatus,
    actualStatus: attendanceStatus.actualStatus,
    tutorLogSubmitted,
  };
}
