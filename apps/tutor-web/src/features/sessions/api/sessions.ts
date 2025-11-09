import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sessions API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_sessions, vtutor_session_detail)
 * All writes must go through API routes that use service role client
 */
export const sessionsApi = {
  /**
   * Get all sessions accessible to the current tutor
   * Uses vtutor_sessions view
   */
  getAllSessions: async () => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_sessions')
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get a single session with all details
   * Uses vtutor_session_detail view which includes students and staff
   */
  getSessionWithDetails: async (sessionId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      const { data, error } = await supabase
        .from('vtutor_session_detail')
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
    } catch (error) {
      console.error('Error getting session with details:', error);
      throw error;
    }
  },

  /**
   * Get a session by ID
   * Uses vtutor_sessions view
   */
  getSession: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },
};
