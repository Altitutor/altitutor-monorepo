import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionStaff, SessionStudent } from '../utils/session-helpers';

interface SessionDetailsMap {
  staff: SessionStaff[];
  students: SessionStudent[];
}

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
   * Get tutor log for a session (for display in session modal)
   * Uses vtutor_tutor_log view
   */
  getTutorLogBySessionId: async (sessionId: string) => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_tutor_log')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
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
  getSessionsWithDetails: async (sessionIds: string[]): Promise<Record<string, SessionDetailsMap>> => {
    if (sessionIds.length === 0) return {};
    
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data, error } = await supabase
      .from('vtutor_session_detail')
      .select('session_id, staff, students')
      .in('session_id', sessionIds);
    
    if (error) throw error;
    
    // Create a map of session_id -> { staff, students }
    const detailsMap: Record<string, SessionDetailsMap> = {};
    
    (data || []).forEach((detail) => {
      const staffJson = detail.staff;
      const studentsJson = detail.students;
      
      // Parse JSON arrays if they're strings, otherwise use as-is
      const staff: SessionStaff[] = Array.isArray(staffJson) 
        ? staffJson.map((s: unknown) => {
            if (typeof s === 'object' && s !== null && 'id' in s && 'first_name' in s && 'last_name' in s && 'role' in s) {
              return {
                id: String(s.id),
                first_name: String(s.first_name),
                last_name: String(s.last_name),
                role: String(s.role),
                type: 'type' in s ? String(s.type) : undefined,
                subjects: 'subjects' in s && Array.isArray(s.subjects) 
                  ? s.subjects.map((subj: unknown) => {
                      if (typeof subj === 'object' && subj !== null && 'id' in subj && 'name' in subj) {
                        return { id: String(subj.id), name: String(subj.name) };
                      }
                      return { id: '', name: '' };
                    })
                  : undefined,
              };
            }
            return { id: '', first_name: '', last_name: '', role: '' };
          })
        : [];
      
      const students: SessionStudent[] = Array.isArray(studentsJson)
        ? studentsJson.map((s: unknown) => {
            if (typeof s === 'object' && s !== null && 'id' in s && 'first_name' in s && 'last_name' in s) {
              return {
                id: String(s.id),
                first_name: String(s.first_name),
                last_name: String(s.last_name),
                year_level: 'year_level' in s && typeof s.year_level === 'number' ? s.year_level : null,
                planned_absence: 'planned_absence' in s ? Boolean(s.planned_absence) : false,
              };
            }
            return { id: '', first_name: '', last_name: '', year_level: null, planned_absence: false };
          })
        : [];
      
      if (detail.session_id) {
        detailsMap[detail.session_id] = {
          staff,
          students,
        };
      }
    });
    
    return detailsMap;
  },

  /**
   * Assign a staff member to a session
   * Uses API route that handles authorization
   */
  assignStaffToSession: async (sessionId: string, staffId: string, type: string = 'MAIN_TUTOR') => {
    const response = await fetch(`/api/sessions/${sessionId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, type }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to assign staff to session' }));
      throw new Error(error.error || 'Failed to assign staff to session');
    }
    
    return response.json();
  },

  /**
   * Add a student to a session
   * Uses API route that handles authorization
   */
  addStudentToSession: async (sessionId: string, studentId: string) => {
    const response = await fetch(`/api/sessions/${sessionId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to add student to session' }));
      throw new Error(error.error || 'Failed to add student to session');
    }
    
    return response.json();
  },
};
