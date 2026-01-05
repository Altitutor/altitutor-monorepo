import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tutor Logs API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_tutor_log)
 * All writes (create tutor logs) must go through API route: POST /api/tutor-logs
 */
export const tutorLogsApi = {
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
