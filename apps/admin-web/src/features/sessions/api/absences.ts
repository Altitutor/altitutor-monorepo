import type {
  AbsenceOperation,
  LogAbsencesResponse,
  GetRescheduleSessionsParams,
  RescheduleSession,
  StudentSession,
} from '../types/absence';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Absences API client for logging student absences
 */
export const absencesApi = {
  /**
   * Log student absences (reschedule or credit)
   * All operations are executed atomically via RPC function
   */
  logAbsences: async (
    operations: AbsenceOperation[],
    staffId: string
  ): Promise<LogAbsencesResponse> => {
    try {
      const response = await fetch('/api/absences/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations,
          staffId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to log absences',
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error logging absences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  /**
   * Get a student's future sessions with session-student enrollment details
   * 
   * Note: We use direct queries from sessions_students rather than search_sessions_admin RPC
   * because we need the sessionsStudentsId from sessions_students table for absence logging.
   * The RPC returns sessions but doesn't provide the sessions_students.id we need.
   */
  getStudentFutureSessions: async (
    studentId: string, 
    weeksAhead: number = 8,
    allowPastSessions: boolean = false,
    weeksBack: number = 4
  ): Promise<StudentSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
    const minDate = allowPastSessions 
      ? new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000)
      : now;

    try {
      // Build query
      let query = supabase
        .from('sessions_students')
        .select(`
          id,
          session_id,
          planned_absence,
          session:sessions!inner(
            *,
            class:classes(
              *,
              subject:subjects(*)
            )
          )
        `)
        .eq('student_id', studentId)
        .eq('planned_absence', false);

      // Only filter by start_at if we're not allowing past sessions
      if (!allowPastSessions) {
        query = query.gte('session.start_at', now.toISOString());
      } else {
        // When allowing past sessions, set a minimum date to avoid loading too many old sessions
        query = query.gte('session.start_at', minDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform, filter by date range, and sort the data client-side
      const sessions: StudentSession[] = (data || [])
        .filter((row: any) => row.session) // Filter out any null sessions
        .map((row: any) => {
          const session = row.session as Tables<'sessions'>;
          return {
            ...session,
            class: row.session.class || null,
            subject: row.session.class?.subject || null,
            sessionsStudentsId: row.id,
          } as StudentSession;
        })
        .filter((session) => {
          // Filter by date range on the client side
          const sessionDate = new Date(session.start_at || 0);
          return sessionDate >= minDate && sessionDate <= maxDate;
        })
        .sort((a, b) => {
          // Sort by start_at ascending
          const dateA = new Date(a.start_at || 0).getTime();
          const dateB = new Date(b.start_at || 0).getTime();
          return dateA - dateB;
        });

      return sessions;
    } catch (error) {
      console.error('Error getting student future sessions:', error);
      throw error;
    }
  },

  /**
   * Get available sessions for rescheduling using RPC function
   * - Future sessions (start_at > now)
   * - Same subject as original session
   * - Different class than original session
   * - Student not already enrolled
   * - Within date range of original session
   */
  getAvailableRescheduleSessions: async (
    params: GetRescheduleSessionsParams
  ): Promise<RescheduleSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { originalSessionId, studentId, dateRangeDays } = params;

    try {
      // Call RPC function to get available reschedule sessions
      const { data, error } = await supabase.rpc('get_available_reschedule_sessions', {
        p_original_session_id: originalSessionId,
        p_student_id: studentId,
        p_date_range_days: dateRangeDays,
      });

      if (error) {
        console.error('Error getting available reschedule sessions:', error);
        throw error;
      }

      // RPC returns JSONB array, Supabase should parse it automatically
      // Handle case where data might be null, undefined, or already parsed
      if (!data) {
        return [];
      }

      // If data is a string (unparsed JSONB), parse it
      let sessions: any[] = [];
      if (typeof data === 'string') {
        try {
          sessions = JSON.parse(data);
        } catch (e) {
          console.error('Error parsing RPC response:', e);
          return [];
        }
      } else if (Array.isArray(data)) {
        sessions = data;
      } else {
        // If it's an object with an error, return empty array
        if (data && typeof data === 'object' && 'error' in data) {
          console.error('RPC returned error:', data.error);
          return [];
        }
        return [];
      }

      // Transform RPC response to RescheduleSession format
      return sessions.map((session: any) => ({
        id: session.id,
        start_at: session.start_at,
        end_at: session.end_at,
        class_id: session.class_id,
        type: session.type,
        status: session.status,
        billing_type: null,
        subject_id: session.class?.subject_id || null,
        created_at: session.created_at,
        updated_at: session.updated_at,
        class: session.class || null,
        subject: session.subject || null,
        studentCount: session.studentCount || 0,
      })) as RescheduleSession[];
    } catch (error) {
      console.error('Error getting available reschedule sessions:', error);
      throw error;
    }
  },
};

