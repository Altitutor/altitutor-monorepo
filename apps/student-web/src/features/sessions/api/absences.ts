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
   * Uses vstudent_session_base view to get sessions with sessions_students_id
   */
  getStudentFutureSessions: async (weeksAhead: number = 8): Promise<StudentSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

    try {
      // Get sessions from vstudent_session_base view (includes sessions_students_id)
      const { data, error } = await supabase
        .from('vstudent_session_base')
        .select('*')
        .gte('start_at', now.toISOString())
        .eq('planned_absence', false)
        .order('start_at', { ascending: true });

      if (error) throw error;

      // Transform and filter by date range
      const sessions: StudentSession[] = (data || [])
        .filter((session: any) => {
          // Filter by date range
          const sessionDate = new Date(session.start_at || 0);
          return sessionDate <= maxDate;
        })
        .map((session: any) => {
          // Extract class and subject from the view data
          // vstudent_session_base includes class and subject fields
          return {
            id: session.session_id,
            start_at: session.start_at,
            end_at: session.end_at,
            class_id: session.class_id,
            type: session.session_type,
            billing_type: null,
            status: 'SCHEDULED',
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
            sessionsStudentsId: session.sessions_students_id,
          } as StudentSession;
        });

      return sessions;
    } catch (error) {
      console.error('Error getting student future sessions:', error);
      throw error;
    }
  },

  /**
   * Get available sessions for rescheduling based on criteria:
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
      // First, get the original session details
      const { data: originalSession, error: originalError } = await supabase
        .from('sessions')
        .select(`
          *,
          class:classes(
            id,
            subject_id,
            subject:subjects(*)
          )
        `)
        .eq('id', originalSessionId)
        .single();

      if (originalError) throw originalError;
      if (!originalSession || !originalSession.class?.subject_id) {
        throw new Error('Original session not found or has no subject');
      }

      const subjectId = originalSession.class.subject_id;
      const originalDate = new Date(originalSession.start_at || '');
      const now = new Date();

      // Calculate date range
      const startDate = new Date(originalDate);
      startDate.setDate(startDate.getDate() - dateRangeDays);
      const endDate = new Date(originalDate);
      endDate.setDate(endDate.getDate() + dateRangeDays);

      // Ensure start date is not in the past
      const effectiveStartDate = startDate < now ? now : startDate;

      // Get sessions with the same subject, different class, within date range
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          class:classes!inner(
            *,
            subject:subjects(*)
          )
        `)
        .eq('class.subject_id', subjectId)
        .neq('class_id', originalSession.class_id)
        .gte('start_at', effectiveStartDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .order('start_at', { ascending: true });

      // Handle errors - 0 rows is valid, return empty array
      if (sessionsError) {
        // PGRST116 means "0 rows" or "Cannot coerce the result to a single JSON object"
        // This can happen when there are no matching sessions, which is valid
        if (sessionsError.code === 'PGRST116' || sessionsError.message?.includes('0 rows')) {
          return [];
        }
        throw sessionsError;
      }

      // If no sessions found, return empty array (this is valid)
      if (!sessions || sessions.length === 0) {
        return [];
      }

      // Get sessions where student is already enrolled (check ALL enrollments)
      const { data: existingEnrollments, error: enrollmentsError } = await supabase
        .from('sessions_students')
        .select('session_id')
        .eq('student_id', effectiveStudentId);

      if (enrollmentsError) throw enrollmentsError;

      const enrolledSessionIds = new Set(
        (existingEnrollments || []).map((e) => e.session_id)
      );

      // Filter out sessions where student is already enrolled
      const availableSessions: RescheduleSession[] = (sessions || [])
        .filter((session: any) => !enrolledSessionIds.has(session.id))
        .map((session: any) => {
          return {
            ...session,
            class: session.class || null,
            subject: session.class?.subject || null,
          } as RescheduleSession;
        });

      // Get student counts for each session
      if (availableSessions.length > 0) {
        const sessionIds = availableSessions.map((s) => s.id);
        const { data: studentCounts, error: countError } = await supabase
          .from('sessions_students')
          .select('session_id')
          .in('session_id', sessionIds)
          .eq('planned_absence', false);

        if (!countError && studentCounts) {
          const countsMap = studentCounts.reduce((acc: Record<string, number>, row) => {
            acc[row.session_id] = (acc[row.session_id] || 0) + 1;
            return acc;
          }, {});

          availableSessions.forEach((session) => {
            session.studentCount = countsMap[session.id] || 0;
          });
        }
      }

      return availableSessions;
    } catch (error) {
      console.error('Error getting available reschedule sessions:', error);
      throw error;
    }
  },
};
