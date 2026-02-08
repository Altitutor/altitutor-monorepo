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
 * Absences API client for logging student absences (self-service)
 */
export const absencesApi = {
  /**
   * Log student absences (reschedule only)
   * All operations are executed atomically via RPC function
   */
  logAbsences: async (
    operations: AbsenceOperation[]
  ): Promise<LogAbsencesResponse> => {
    try {
      const response = await fetch('/api/absences/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations,
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
   * Get current student's future sessions with session-student enrollment details
   * Uses vstudent_session_base view to get sessions with session_student_id
   */
  getStudentFutureSessions: async (weeksAhead: number = 8): Promise<StudentSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

    try {
      // Get sessions from vstudent_session_base view (includes session_student_id)
      const { data, error } = await supabase
        .from('vstudent_session_base')
        .select('*')
        .gte('start_at', now.toISOString())
        .eq('planned_absence', false)
        .order('start_at', { ascending: true });

      if (error) throw error;

      // Transform and filter by date range
      const sessions: StudentSession[] = (data || [])
        .filter((session) => {
          // Filter by date range
          const sessionDate = new Date((session as { start_at?: string }).start_at || 0);
          return sessionDate <= maxDate;
        })
        .filter((session) => {
          // Filter out sessions without session_student_id (required for absence logging)
          return !!(session as { session_student_id?: string }).session_student_id;
        })
        .map((session) => {
          // Extract class and subject from the view data
          // vstudent_session_base includes class and subject fields
          const mappedSession = {
            id: session.session_id,
            start_at: session.start_at,
            end_at: session.end_at,
            class_id: session.class_id,
            type: session.session_type,
            billing_type: null,
            status: 'SCHEDULED' as const,
            subject_id: session.subject_id,
            created_at: session.session_created_at,
            updated_at: session.session_updated_at,
            class: session.class_id ? {
              id: session.class_id,
              day_of_week: session.day_of_week,
              start_time: session.start_time,
              end_time: session.end_time,
              room: session.room,
              level: session.class_level,
              status: session.class_status,
              subject_id: session.subject_id,
              created_at: null,
              updated_at: null,
            } as Tables<'classes'> : null,
            subject: session.subject_id ? {
              id: session.subject_id,
              name: session.subject_name,
              curriculum: session.subject_curriculum,
              discipline: session.subject_discipline,
              level: session.subject_level,
              color: session.subject_color,
              year_level: session.subject_year_level,
              created_at: null,
              updated_at: null,
            } as Tables<'subjects'> : null,
            sessionsStudentsId: session.session_student_id,
          } as StudentSession;
          
          return mappedSession;
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

    // If studentId is not provided, get it from current_student_id RPC
    let effectiveStudentId = studentId;
    if (!effectiveStudentId) {
      const { data: currentStudentId, error: studentIdError } = await supabase.rpc('current_student_id');
      if (studentIdError || !currentStudentId) {
        throw new Error('Failed to get student ID');
      }
      effectiveStudentId = currentStudentId;
    }

    try {
      // Call RPC function to get available reschedule sessions
      const { data, error } = await supabase.rpc('get_available_reschedule_sessions', {
        p_original_session_id: originalSessionId,
        p_student_id: effectiveStudentId,
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
