import type { Database } from '@altitutor/shared';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SessionStudentRow = {
  student_id: string;
  planned_absence: boolean;
};

/**
 * API for tutor-log-specific view queries.
 * Tutor-web uses vtutor_* views for RLS-scoped data access.
 */
export const tutorViewsApi = {
  /**
   * Get students by IDs from vtutor_students view.
   */
  getStudentsByIds: async (ids: string[]) => {
    if (ids.length === 0) return [];
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_students')
      .select('*')
      .in('id', ids)
      .order('first_name');
    if (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
    return data ?? [];
  },

  /**
   * Get all students from vtutor_students view (for search).
   * Note: This only returns students accessible through tutor's classes/sessions.
   * For adding TRIAL students not in classes/sessions, use searchStudents API endpoint.
   */
  getAllStudents: async () => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_students')
      .select('*')
      .order('first_name');
    if (error) {
      console.error('Error fetching all students:', error);
      throw error;
    }
    return (data ?? []) as Tables<'students'>[];
  },

  /**
   * Search for students (including TRIAL) via API endpoint.
   * This allows tutors to find and add students not in their classes/sessions.
   */
  searchStudents: async (params: { search?: string; limit?: number }): Promise<Tables<'students'>[]> => {
    const { search = '', limit = 100 } = params || {};
    const searchParams = new URLSearchParams();
    if (search) searchParams.set('search', search);
    searchParams.set('limit', limit.toString());
    
    const response = await fetch(`/api/students/search?${searchParams.toString()}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to search students' }));
      throw new Error(error.error || 'Failed to search students');
    }
    
    const result = await response.json();
    return result.students || [];
  },

  /**
   * Get session students from vtutor_sessions_students view.
   */
  getSessionStudents: async (sessionId: string): Promise<SessionStudentRow[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_sessions_students')
      .select('student_id, planned_absence')
      .eq('session_id', sessionId);
    if (error) {
      console.error('Error fetching session students:', error);
      throw error;
    }
    return (data ?? [])
      .filter((row): row is typeof row & { student_id: string } => row.student_id != null)
      .map((row) => ({
        student_id: row.student_id,
        planned_absence: row.planned_absence ?? false,
      }));
  },
};
