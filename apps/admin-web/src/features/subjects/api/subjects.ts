import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subjects API client for working with subject data
 */
export const subjectsApi = {
  /**
   * Get all subjects
   */
  getAllSubjects: async (): Promise<Tables<'subjects'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .select('id, name, curriculum, year_level, discipline, color, level');
    if (error) throw error;
    return (data ?? []) as Tables<'subjects'>[];
  },
  
  /**
   * Paginated, server-filtered subject list for pickers
   * Uses search_subjects_admin RPC function for optimized search with exact + fuzzy matching
   */
  list: async (params: { 
    search?: string; 
    yearLevels?: number[];
    curriculums?: string[];
    disciplines?: string[];
    levels?: string[];
    limit?: number; 
    offset?: number;
    orderBy?: 'name' | 'curriculum' | 'year_level' | 'discipline' | 'level';
    ascending?: boolean;
  }): Promise<{ subjects: Tables<'subjects'>[]; total: number }> => {
    const { 
      search = '', 
      yearLevels,
      curriculums,
      disciplines,
      levels,
      limit = 20, 
      offset = 0,
      orderBy = 'name',
      ascending = true
    } = params || {};
    
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const trimmed = search.trim();
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_subjects_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_year_levels: yearLevels && yearLevels.length > 0 ? yearLevels : undefined,
      p_curriculums: curriculums && curriculums.length > 0 ? curriculums : undefined,
      p_disciplines: disciplines && disciplines.length > 0 ? disciplines : undefined,
      p_levels: levels && levels.length > 0 ? levels : undefined,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy,
      p_ascending: ascending,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { subjects: [], total: 0 };

    const rpcData = rpcResult as { subjects: any[]; total: number };
    return { 
      subjects: (rpcData.subjects || []) as Tables<'subjects'>[], 
      total: rpcData.total ?? 0 
    };
  },
  
  /**
   * Get a subject by ID
   */
  getSubject: async (id: string): Promise<Tables<'subjects'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'subjects'> | null;
  },
  
  /**
   * Search subjects by name, curriculum, or year level
   * Uses search_subjects_admin RPC function for optimized search with exact + fuzzy matching
   */
  searchSubjects: async (query: string): Promise<Tables<'subjects'>[]> => {
    const { subjects } = await subjectsApi.list({ search: query, limit: 20, offset: 0 });
    return subjects;
  },
  
  /**
   * Create a new subject
   */
  createSubject: async (data: TablesInsert<'subjects'>): Promise<Tables<'subjects'>> => {
    const payload: TablesInsert<'subjects'> = { ...data };
    const { data: created, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'subjects'>;
  },
  
  /**
   * Update a subject
   */
  updateSubject: async (id: string, data: TablesUpdate<'subjects'>): Promise<Tables<'subjects'>> => {
    const { data: updated, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Tables<'subjects'>;
  },
  
  /**
   * Delete a subject
   */
  deleteSubject: async (id: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Bulk update subject colors
   */
  bulkUpdateColors: async (subjectIds: string[], color: string | null): Promise<Tables<'subjects'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .update({ color })
      .in('id', subjectIds)
      .select();
    if (error) throw error;
    return (data ?? []) as Tables<'subjects'>[];
  },

  // Removed redundant direct getter alias

  /**
   * Get staff members assigned to a subject
   */
  getSubjectStaff: async (subjectId: string): Promise<Tables<'staff'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('staff_subjects')
        .select(`
          staff:staff(*)
        `)
        .eq('subject_id', subjectId);
      if (error) throw error;
      const staff = (data ?? [])
        .map((row: any) => row.staff as Tables<'staff'>)
        .filter(Boolean);
      return staff;
    } catch (error) {
      console.error('Error getting subject staff:', error);
      throw error;
    }
  },

  /**
   * Get students enrolled in a subject
   */
  getSubjectStudents: async (subjectId: string): Promise<Tables<'students'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('students_subjects')
        .select(`
          student:students(*)
        `)
        .eq('subject_id', subjectId);
      if (error) throw error;
      const students = (data ?? [])
        .map((row: any) => row.student as Tables<'students'>)
        .filter(Boolean);
      return students;
    } catch (error) {
      console.error('Error getting subject students:', error);
      throw error;
    }
  },

  /**
   * Get classes for a subject
   */
  getSubjectClasses: async (subjectId: string): Promise<Tables<'classes'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('classes')
        .select('*')
        .eq('subject_id', subjectId);
      if (error) throw error;
      return (data ?? []) as Tables<'classes'>[];
    } catch (error) {
      console.error('Error getting subject classes:', error);
      throw error;
    }
  },

  /**
   * Get topics for a subject
   */
  getSubjectTopics: async (subjectId: string): Promise<Tables<'topics'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('topics')
        .select('*')
        .eq('subject_id', subjectId)
        .order('number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<'topics'>[];
    } catch (error) {
      console.error('Error getting subject topics:', error);
      throw error;
    }
  },

}; 