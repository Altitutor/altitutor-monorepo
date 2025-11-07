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
   */
  getStudentFutureSessions: async (studentId: string, weeksAhead: number = 8): Promise<StudentSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date();
    const maxDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

    try {
      // Get sessions_students records for this student with session details
      const { data, error } = await supabase
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
        .eq('planned_absence', false)
        .gte('session.start_at', now.toISOString());

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
          return sessionDate <= maxDate;
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

      if (sessionsError) throw sessionsError;

      // Get sessions where student is already enrolled
      const { data: existingEnrollments, error: enrollmentsError } = await supabase
        .from('sessions_students')
        .select('session_id')
        .eq('student_id', studentId)
        .eq('planned_absence', false);

      if (enrollmentsError) throw enrollmentsError;

      const enrolledSessionIds = new Set(
        (existingEnrollments || []).map((e) => e.session_id)
      );

      // Filter out sessions where student is already enrolled
      const availableSessions: RescheduleSession[] = (sessions || [])
        .filter((session: any) => !enrolledSessionIds.has(session.id))
        .map((session: any) => {
          // Count students in this session
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

