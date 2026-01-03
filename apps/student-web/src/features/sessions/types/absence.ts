import type { Tables } from '@altitutor/shared';

/**
 * Action type for absence logging (students can only reschedule)
 */
export type AbsenceAction = 'reschedule';

/**
 * Operation structure for API submission
 */
export interface AbsenceOperation {
  student_id: string;
  original_sessions_students_id: string;
  action: AbsenceAction;
  target_session_id: string; // Required for reschedule
}

/**
 * UI state for tracking user decisions during the wizard
 */
export interface AbsenceDecision {
  sessionId: string;
  sessionsStudentsId: string;
  action: AbsenceAction | null;
  targetSessionId?: string; // For reschedule action
}

/**
 * Session data with additional info for reschedule options
 */
export interface RescheduleSession extends Tables<'sessions'> {
  class?: Tables<'classes'> | null;
  subject?: Tables<'subjects'> | null;
  studentCount?: number;
}

/**
 * Student's session with enrollment details
 */
export interface StudentSession extends Tables<'sessions'> {
  class?: Tables<'classes'> | null;
  subject?: Tables<'subjects'> | null;
  sessionsStudentsId: string; // The ID from sessions_students table
}

/**
 * Response from the API
 */
export interface LogAbsencesResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Parameters for fetching available reschedule sessions
 */
export interface GetRescheduleSessionsParams {
  originalSessionId: string;
  studentId: string;
  dateRangeDays: number; // +/- days from original session
}
