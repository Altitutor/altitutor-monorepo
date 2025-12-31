import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorLogFormData, TutorLogWithDetails } from '../types';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tutor Logs API client
 */
export const tutorLogsApi = {
  /**
   * Create a tutor log with all related records atomically via RPC function
   * All operations are executed within a single transaction
   */
  createTutorLog: async (data: TutorLogFormData, createdBy: string): Promise<Tables<'tutor_logs'>> => {
    try {
      const response = await fetch('/api/tutor-logs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          createdBy,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tutor log');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create tutor log');
      }

      // Fetch the created tutor log to return it
      const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
      const tutorLogId = (result.data as any)?.tutor_log_id;
      
      if (!tutorLogId) {
        throw new Error('Tutor log ID not returned from RPC function');
      }

      const { data: tutorLog, error: fetchError } = await supabase
        .from('tutor_logs')
        .select('*')
        .eq('id', tutorLogId)
        .single();

      if (fetchError) throw fetchError;
      if (!tutorLog) throw new Error('Tutor log not found after creation');

      return tutorLog as Tables<'tutor_logs'>;
    } catch (error) {
      console.error('Error creating tutor log:', error);
      throw error;
    }
  },

  /**
   * Get a single tutor log with all related data
   */
  getTutorLog: async (id: string): Promise<TutorLogWithDetails | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;

    try {
      const { data: tutorLog, error: tutorLogError } = await supabase
        .from('tutor_logs')
        .select(`
          *,
          session:sessions!inner(
            *,
            class:classes!inner(
              *,
              subject:subjects(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (tutorLogError) {
        if (tutorLogError.code === 'PGRST116') return null;
        throw tutorLogError;
      }

      // Get staff attendance
      const { data: staffAttendance } = await supabase
        .from('tutor_logs_staff_attendance')
        .select('*, staff:staff(*)')
        .eq('tutor_log_id', id);

      // Get student attendance
      const { data: studentAttendance } = await supabase
        .from('tutor_logs_student_attendance')
        .select('*, student:students(*)')
        .eq('tutor_log_id', id);

      // Get topics with students
      const { data: topics } = await supabase
        .from('tutor_logs_topics')
        .select(`
          *,
          topic:topics(*),
          students:tutor_logs_topics_students(
            *,
            student:students(*)
          )
        `)
        .eq('tutor_log_id', id);

      // Get topic files with students
      const { data: topicFiles } = await supabase
        .from('tutor_logs_topics_files')
        .select(`
          *,
          topicFile:topics_files(*),
          students:tutor_logs_topics_files_students(
            *,
            student:students(*)
          )
        `)
        .eq('tutor_log_id', id);

      // Get notes
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('target_type', 'tutor_logs')
        .eq('target_id', id);

      return {
        ...tutorLog,
        staffAttendance: staffAttendance || [],
        studentAttendance: studentAttendance || [],
        topics: topics || [],
        topicFiles: topicFiles || [],
        notes: notes || [],
      } as TutorLogWithDetails;
    } catch (error) {
      console.error('Error getting tutor log:', error);
      throw error;
    }
  },

  /**
   * Check if a session has been logged
   */
  getTutorLogForSession: async (sessionId: string): Promise<Tables<'tutor_logs'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('tutor_logs')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Tables<'tutor_logs'> | null;
  },

  /**
   * Get sessions that haven't been logged yet for a staff member
   * Only returns past/current sessions (start_at <= NOW())
   */
  getUnloggedSessions: async (staffId: string): Promise<Array<Tables<'sessions'> & { 
    class: Tables<'classes'> & { subject: Tables<'subjects'> } 
  }>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;

    try {
      // Get all sessions where this staff is assigned
      const { data: sessionStaffRecords, error: sessionStaffError } = await supabase
        .from('sessions_staff')
        .select('session_id')
        .eq('staff_id', staffId);

      if (sessionStaffError) throw sessionStaffError;

      const sessionIds = (sessionStaffRecords || []).map((r) => r.session_id);

      if (sessionIds.length === 0) return [];

      // Get sessions that are past/current (not logged yet)
      // Filter by date (not timestamp) - allow sessions from today or earlier
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          class:classes!inner(
            *,
            subject:subjects(*)
          )
        `)
        .in('id', sessionIds)
        .eq('type', 'CLASS')
        .lte('start_at', today.toISOString())
        .order('start_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Filter out sessions that already have logs
      const { data: existingLogs, error: logsError } = await supabase
        .from('tutor_logs')
        .select('session_id')
        .in('session_id', sessionIds);

      if (logsError) throw logsError;

      const loggedSessionIds = new Set((existingLogs || []).map((log) => log.session_id));

      return (sessions || []).filter((s: any) => !loggedSessionIds.has(s.id)) as any[];
    } catch (error) {
      console.error('Error getting unlogged sessions:', error);
      throw error;
    }
  },

  /**
   * Get all tutor logs (admin only)
   */
  getAllTutorLogs: async (params?: { limit?: number; offset?: number; dateFrom?: string; dateTo?: string }): Promise<{ logs: Tables<'tutor_logs'>[]; total: number }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { limit = 1000, offset = 0, dateFrom, dateTo } = params || {};
    
    let query = supabase
      .from('tutor_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Add date range filters if provided
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply pagination
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      logs: (data ?? []) as Tables<'tutor_logs'>[],
      total: count ?? 0,
    };
  },

  /**
   * Update a tutor log (admin only)
   */
  updateTutorLog: async (id: string, updates: Partial<TutorLogFormData>): Promise<void> => {
    // This is complex - for now, just throw an error
    // In a real implementation, you'd need to diff the changes and update accordingly
    throw new Error('Tutor log updates not yet implemented');
  },

  /**
   * Delete a tutor log (admin only)
   * This will cascade delete all related records
   */
  deleteTutorLog: async (id: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('tutor_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

