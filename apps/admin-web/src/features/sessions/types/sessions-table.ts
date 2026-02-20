import type { Tables } from '@altitutor/shared';
import type {
  StudentAttendanceStatus,
  StaffAttendanceStatus,
} from '../constants/attendanceStatuses';

// Re-export attendance status types from constants
export type { StudentAttendanceStatus, StaffAttendanceStatus };

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
  actual_was_trial?: boolean | null;
  actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
  is_swapped_in?: boolean;
  is_swapped?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  sessions_staff_id?: string | null;
  was_trial?: boolean;
};
