import type { Tables } from '@altitutor/shared';

/**
 * Action type for staff absence logging
 */
export type StaffAbsenceAction = 'swap' | 'log';

/**
 * Operation structure for API submission
 */
export interface StaffAbsenceOperation {
  staff_id: string;
  original_sessions_staff_id: string;
  action: StaffAbsenceAction;
  replacement_staff_id?: string; // Required for swap, not for log
}

/**
 * UI state for tracking user decisions during the wizard
 */
export interface StaffAbsenceDecision {
  sessionId: string;
  sessionsStaffId: string;
  action: StaffAbsenceAction | null;
  replacementStaffId?: string; // For swap action
}

/**
 * Staff's session with enrollment details
 */
export interface StaffSession extends Tables<'sessions'> {
  class?: Tables<'classes'> | null;
  subject?: Tables<'subjects'> | null;
  sessionsStaffId: string; // The ID from sessions_staff table
}

/**
 * Available replacement staff member
 */
export interface ReplacementStaff extends Tables<'staff'> {
  subjects?: Tables<'subjects'>[];
}

/**
 * Response from the API
 */
export interface LogStaffAbsencesResponse {
  success: boolean;
  data?: {
    updated_sessions_staff: Tables<'sessions_staff'>[];
    created_sessions_staff?: Tables<'sessions_staff'>[];
  };
  error?: string;
}

/**
 * Parameters for fetching available replacement staff
 */
export interface GetReplacementStaffParams {
  sessionId: string;
  subjectId: string;
  excludeStaffIds: string[]; // Staff IDs to exclude (original staff, already assigned, etc.)
}

