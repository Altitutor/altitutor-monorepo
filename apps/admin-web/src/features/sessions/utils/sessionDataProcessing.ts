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
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  type StudentAttendanceInput,
  type StaffAttendanceInput,
  type StudentAttendanceContext,
  type StaffAttendanceContext,
} from './attendanceDerivation';

export type ProcessedStudentData = {
  student: Tables<'students'>;
  sessionsStudentsId: string | null;
  rescheduledSessionsStudentsId: string | null;
  plannedStatus: StudentPlannedStatus;
  actualStatus: StudentActualStatus;
  rescheduledDate: string;
  rescheduledSessionId?: string;
  invoiceStatus: string | null;
  plannedAbsence: boolean;
  hasInvoiceItems: boolean;
};

export type ProcessedStaffData = {
  staff: Tables<'staff'>;
  sessionsStaffId: string | null;
  swappedSessionsStaffId: string | null;
  plannedStatus: StaffPlannedStatus;
  actualStatus: StaffActualStatus;
  staffType?: string;
  swappedStaffName: string;
  swappedStaffId: string;
  submittedTutorLog: boolean;
  plannedAbsence: boolean;
};

type SessionStudentItem = {
  student_id: string;
  student: Tables<'students'> | null;
  sessions_students_id?: string | null;
  rescheduled_sessions_students_id?: string | null;
  planned_absence?: boolean;
  is_extra?: boolean;
  was_trial?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  invoice_status?: string | null;
  rescheduled_session?: {
    session?: {
      id: string;
      start_at?: string | null;
      class?: {
        start_time?: string | null;
      } | null;
    } | null;
  } | null;
};

type SessionStaffItem = {
  id?: string;
  staff_id: string;
  staff?: Tables<'staff'> | null;
  planned_absence?: boolean;
  is_swapped?: boolean;
  was_trial?: boolean;
  swapped_sessions_staff_id?: string | null;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

// Re-export attendance map builders from centralized module
export { buildStudentAttendanceMap, buildStaffAttendanceMap };

/**
 * Process session students data
 */
export function processSessionStudents(
  sessionsStudents: SessionStudentItem[],
  actualStudentAttendance: Record<string, { attended: boolean; was_trial?: boolean }>,
  hasTutorLog: boolean
): ProcessedStudentData[] {
  // Only process rows with a resolved student (exclude null from API joins)
  const withStudent = sessionsStudents.filter(
    (ss): ss is SessionStudentItem & { student: Tables<'students'> } => ss.student != null
  );
  // Build set of student IDs that are in sessions_students (planned students)
  const plannedStudentIds = new Set(
    withStudent
      .filter((ss) => ss.student_id && (ss.sessions_students_id !== null && ss.sessions_students_id !== undefined))
      .map((ss) => ss.student_id)
  );

  return withStudent.map((ss) => {
    const input: StudentAttendanceInput = {
      student_id: ss.student_id,
      sessions_students_id: ss.sessions_students_id,
      planned_absence: ss.planned_absence,
      is_extra: ss.is_extra,
      was_trial: ss.was_trial,
      is_rescheduled: ss.is_rescheduled,
      is_credited: ss.is_credited,
      rescheduled_session: ss.rescheduled_session,
      actual_attended: actualStudentAttendance[ss.student_id]?.attended,
      actual_was_trial: actualStudentAttendance[ss.student_id]?.was_trial,
    };

    const context: StudentAttendanceContext = {
      hasTutorLog,
      plannedStudentIds,
    };

    const attendanceStatus = deriveStudentAttendanceStatus(input, context);

    return {
      student: ss.student,
      sessionsStudentsId: ss.sessions_students_id ?? null,
      rescheduledSessionsStudentsId: ss.rescheduled_sessions_students_id ?? null,
      plannedStatus: attendanceStatus.plannedStatus,
      actualStatus: attendanceStatus.actualStatus,
      rescheduledDate: attendanceStatus.rescheduledDate,
      rescheduledSessionId: attendanceStatus.rescheduledSessionId,
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
  actualStaffAttendance: Record<string, { attended: boolean; type?: string; was_trial?: boolean }>,
  hasTutorLog: boolean,
  tutorLogCreatedBy?: string
): ProcessedStaffData[] {
  // Only process rows with a resolved staff (exclude null from API joins)
  const withStaff = sessionsStaff.filter(
    (sf): sf is SessionStaffItem & { staff: Tables<'staff'> } => sf.staff != null
  );
  return withStaff.map((sf) => {
    const input: StaffAttendanceInput = {
      planned_absence: sf.planned_absence,
      is_swapped: sf.is_swapped,
      swapped_staff: sf.swapped_staff,
      was_trial: sf.was_trial,
      actual_attended: actualStaffAttendance[sf.staff_id]?.attended,
      actual_was_trial: actualStaffAttendance[sf.staff_id]?.was_trial,
    };

    const context: StaffAttendanceContext = {
      hasTutorLog,
    };

    const attendanceStatus = deriveStaffAttendanceStatus(input, context);

    const submittedTutorLog = tutorLogCreatedBy === sf.staff_id;

    return {
      staff: sf.staff,
      sessionsStaffId: sf.id ?? null,
      swappedSessionsStaffId: sf.swapped_sessions_staff_id ?? null,
      plannedStatus: attendanceStatus.plannedStatus,
      actualStatus: attendanceStatus.actualStatus,
      staffType: actualStaffAttendance[sf.staff_id]?.type,
      swappedStaffName: attendanceStatus.swappedStaffName,
      swappedStaffId: attendanceStatus.swappedStaffId,
      submittedTutorLog,
      plannedAbsence: sf.planned_absence || false,
    };
  });
}
