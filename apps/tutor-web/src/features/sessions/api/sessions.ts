import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { dateStringToUtcEnd, dateStringToUtcStart } from '@/shared/utils/datetime';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionParent, SessionStaff, SessionStudent } from '../utils/session-helpers';
import { parseSessionParentList, parseSessionStaffList, parseSessionStudentList } from '../utils/parseSessionDetailJson';

export type TutorSessionDetailsMap = {
  staff: SessionStaff[];
  students: SessionStudent[];
  parents: SessionParent[];
};

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
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.from('vtutor_sessions').select('*');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Sessions for the current tutor within [rangeStart, rangeEnd] (YYYY-MM-DD, local calendar days).
   */
  getSessionsInDateRange: async (rangeStart: string, rangeEnd: string) => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const utcStart = dateStringToUtcStart(rangeStart);
    const utcEnd = dateStringToUtcEnd(rangeEnd);
    const { data, error } = await supabase
      .from('vtutor_sessions')
      .select('*')
      .gte('start_at', utcStart)
      .lte('start_at', utcEnd)
      .order('start_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Sessions originally scheduled in this range (moved off the viewed day).
   * Falls back to [] if the view does not yet expose original_start_at.
   */
  getSessionsOriginallyInDateRange: async (rangeStart: string, rangeEnd: string) => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const utcStart = dateStringToUtcStart(rangeStart);
    const utcEnd = dateStringToUtcEnd(rangeEnd);
    const { data, error } = await supabase
      .from('vtutor_sessions')
      .select('*')
      .filter('original_start_at', 'gte', utcStart)
      .filter('original_start_at', 'lte', utcEnd)
      .not('original_start_at', 'is', null)
      .order('start_at', { ascending: true });

    if (error) {
      if (
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        /original_start_at/i.test(error.message)
      ) {
        return [];
      }
      throw error;
    }
    return data ?? [];
  },

  /**
   * Get a single session with all details
   * Uses vtutor_session_detail view which includes students and staff
   */
  getSessionWithDetails: async (sessionId: string) => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

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
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.from('vtutor_sessions').select('*').eq('session_id', id).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },

  /**
   * Get multiple sessions with details (staff and students)
   * Uses vtutor_session_detail view
   * Returns a map of session_id -> { staff, students }
   */
  getSessionsWithDetails: async (sessionIds: string[]): Promise<Record<string, TutorSessionDetailsMap>> => {
    if (sessionIds.length === 0) return {};

    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase.from('vtutor_session_detail').select('*').in('session_id', sessionIds);

    if (error) throw error;

    const detailsMap: Record<string, TutorSessionDetailsMap> = {};

    (data || []).forEach((detail) => {
      if (!detail.session_id) return;
      const extra = detail as typeof detail & { parents?: unknown };
      detailsMap[detail.session_id] = {
        staff: parseSessionStaffList(detail.staff),
        students: parseSessionStudentList(detail.students),
        parents: parseSessionParentList(extra.parents),
      };
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
