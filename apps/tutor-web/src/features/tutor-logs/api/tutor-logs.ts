import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TutorLogFormData } from '../types';

/**
 * Tutor Logs API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_tutor_log, vtutor_sessions)
 * All writes (create tutor logs) must go through API route: POST /api/tutor-logs
 */
export const tutorLogsApi = {
  /**
   * Create a tutor log via API route
   */
  createTutorLog: async (data: TutorLogFormData): Promise<{ tutorLogId: string }> => {
    const response = await fetch('/api/tutor-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create tutor log');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create tutor log');
    }

    // Extract tutor_log_id from RPC result
    const tutorLogId = (result.data as any)?.tutor_log_id;
    
    if (!tutorLogId) {
      throw new Error('Tutor log ID not returned from RPC function');
    }

    return { tutorLogId };
  },

  /**
   * Get a tutor log by ID
   * Uses vtutor_tutor_log view
   */
  getTutorLogWithDetails: async (tutorLogId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_tutor_log')
      .select('*')
      .eq('tutor_log_id', tutorLogId)
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  },

  /**
   * Get tutor log by session ID
   * Uses vtutor_tutor_log view
   */
  getTutorLogBySessionId: async (sessionId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_tutor_log')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  },

  /**
   * Get tutor log for a session (alias for getTutorLogBySessionId)
   */
  getTutorLogForSession: async (sessionId: string) => {
    return tutorLogsApi.getTutorLogBySessionId(sessionId);
  },

  /**
   * Get sessions that haven't been logged yet for the current tutor
   * Only returns past/current sessions (start_at <= NOW())
   */
  getUnloggedSessions: async (staffId: string): Promise<Array<Database['public']['Views']['vtutor_sessions']['Row'] & { 
    class?: { 
      subject?: Database['public']['Tables']['subjects']['Row'] 
    } 
  }>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);

    try {
      // Get all sessions accessible to this tutor (from vtutor_sessions view)
      // Filter by date (not timestamp) - allow sessions from today or earlier
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const { data: sessions, error: sessionsError } = await supabase
        .from('vtutor_sessions')
        .select('*')
        .eq('session_type', 'CLASS')
        .lte('start_at', today.toISOString())
        .order('start_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) return [];

      const sessionIds = sessions.map((s) => s.session_id);

      // Filter out sessions that already have logs
      const { data: existingLogs, error: logsError } = await supabase
        .from('vtutor_tutor_log')
        .select('session_id')
        .in('session_id', sessionIds);

      if (logsError) throw logsError;

      const loggedSessionIds = new Set((existingLogs || []).map((log) => log.session_id));

      // Filter and transform sessions to match expected format
      return (sessions || []).filter((s) => !loggedSessionIds.has(s.session_id)).map((s) => {
        // Transform vtutor_sessions row to match expected format
        return {
          ...s,
          id: s.session_id,
          class: s.class_id ? {
            id: s.class_id,
            subject: s.subject_id ? {
              id: s.subject_id,
              name: s.subject_name,
              curriculum: s.subject_curriculum,
              discipline: s.subject_discipline,
              level: s.subject_level,
              color: s.subject_color,
              year_level: s.subject_year_level,
            } : undefined,
          } : undefined,
        } as any;
      });
    } catch (error) {
      console.error('Error getting unlogged sessions:', error);
      throw error;
    }
  },

  /**
   * Get all tutor logs for the current tutor
   * Note: vtutor_tutor_log is a single-log view, so we can't list all logs directly.
   * This would require a different approach or a list view.
   * For now, returns empty array - individual logs should use getTutorLog
   */
  getAllTutorLogs: async () => {
    // vtutor_tutor_log is designed for single log access
    // To list all logs, we'd need a separate view or query pattern
    // For now, return empty - this method may not be used in tutor-web
    return [];
  },
};
