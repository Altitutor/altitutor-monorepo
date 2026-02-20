import type { Tables } from '@altitutor/shared';

/**
 * Extended student type for sessions table (with attendance and billing metadata).
 */
export type SessionTableStudent = Tables<'students'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  actual_was_trial?: boolean | null;
  invoice_status?: string | null;
  sessions_students_id?: string | null;
  is_extra?: boolean;
  was_trial?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  rescheduled_session?: {
    session?: {
      id: string;
      start_at?: string;
      class?: {
        start_time?: string | null;
      } | null;
    } | null;
  } | null;
};

/**
 * Extended staff type for sessions table (with attendance and swap metadata).
 */
export type SessionTableStaff = Tables<'staff'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
  is_swapped_in?: boolean;
  is_swapped?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  sessions_staff_id?: string | null;
};

export type StudentAttendanceStatus = {
  plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned';
  actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend';
  rescheduledSessionId: string;
  rescheduledDate: string;
};

export type StaffAttendanceStatus = {
  plannedStatus: 'attending' | 'absent' | 'swapped';
  actualStatus: 'not-logged' | 'attended' | 'did-not-attend';
  swappedStaffId: string;
  swappedStaffName: string;
};
