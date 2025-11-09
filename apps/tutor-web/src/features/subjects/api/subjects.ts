import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subjects API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_subjects)
 * All writes must go through API routes that use service role client
 */
export const subjectsApi = {
  /**
   * Get all subjects accessible to the current tutor
   * Uses vtutor_subjects view
   */
  getAllSubjects: async () => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_subjects')
      .select('*');
    if (error) throw error;
    return data ?? [];
  },
  
  /**
   * Paginated, server-filtered subject list for pickers
   * Uses vtutor_subjects view
   */
  list: async (params: { search?: string; limit?: number; offset?: number }) => {
    const { search = '', limit = 20, offset = 0 } = params || {};
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    let query = supabase
      .from('vtutor_subjects')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true });
    
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(`name.ilike.${q},level.ilike.${q}`);
    }
    
    const { data, count, error } = await query.range(offset, Math.max(offset + limit - 1, offset));
    if (error) throw error;
    return { subjects: data ?? [], total: count ?? 0 };
  },
  
  /**
   * Get a subject by ID
   * Uses vtutor_subjects view
   */
  getSubject: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_subjects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },
  
  /**
   * Search subjects by name, curriculum, or year level
   * Uses vtutor_subjects view
   */
  searchSubjects: async (query: string) => {
    const { subjects } = await subjectsApi.list({ search: query, limit: 20, offset: 0 });
    return subjects;
  },
};
