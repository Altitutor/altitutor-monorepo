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
   * Note: The view uses 'session_id' as the column name, not 'id'
   */
  getSession: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_sessions')
      .select('*')
      .eq('session_id', id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },

  /**
   * Get multiple sessions with details (staff and students)
   * Uses vtutor_session_detail view
   * Returns a map of session_id -> { staff, students }
   */
  getSessionsWithDetails: async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return {};
    
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data, error } = await supabase
      .from('vtutor_session_detail')
      .select('session_id, staff, students')
      .in('session_id', sessionIds);
    
    if (error) throw error;
    
    // Create a map of session_id -> { staff, students }
    const detailsMap: Record<string, { staff: any[]; students: any[] }> = {};
    
    (data || []).forEach((detail: any) => {
      const staff = Array.isArray(detail.staff) ? detail.staff : [];
      const students = Array.isArray(detail.students) ? detail.students : [];
      
      detailsMap[detail.session_id] = {
        staff: staff.map((s: any) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          role: s.role,
        })),
        students: students.map((s: any) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          year_level: s.year_level,
        })),
      };
    });
    
    return detailsMap;
  },
};
