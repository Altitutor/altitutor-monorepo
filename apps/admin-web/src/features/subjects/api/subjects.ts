import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/**
 * Subjects API client for working with subject data
 */
export const subjectsApi = {
  /**
   * Get all subjects
   */
  getAllSubjects: async (): Promise<Tables<'subjects'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('subjects')
      .select('id, name, curriculum, year_level, discipline, color, level');
    if (error) throw error;
    return (data ?? []) as Tables<'subjects'>[];
  },
  
  /**
   * Paginated, server-filtered subject list for pickers
   */
  list: async (params: { search?: string; limit?: number; offset?: number }): Promise<{ subjects: Tables<'subjects'>[]; total: number }> => {
    const { search = '', limit = 20, offset = 0 } = params || {};
    let query = getSupabaseClient()
      .from('subjects')
      .select('id, name, curriculum, year_level, discipline, color, level', { count: 'exact' })
      .order('name', { ascending: true });
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(`name.ilike.${q},level.ilike.${q}`);
    }
    const { data, count, error } = await query.range(offset, Math.max(offset + limit - 1, offset));
    if (error) throw error;
    return { subjects: (data ?? []) as Tables<'subjects'>[], total: count ?? 0 };
  },
  
  /**
   * Get a subject by ID
   */
  getSubject: async (id: string): Promise<Tables<'subjects'> | null> => {
    const { data, error } = await getSupabaseClient()
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'subjects'> | null;
  },
  
  /**
   * Search subjects by name, curriculum, or year level
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
    const { data: created, error } = await getSupabaseClient()
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
    const { data: updated, error } = await getSupabaseClient()
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
    const { error } = await getSupabaseClient()
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Removed redundant direct getter alias

  /**
   * Get staff members assigned to a subject
   */
  getSubjectStaff: async (subjectId: string): Promise<Tables<'staff'>[]> => {
    try {
      const { data, error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
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

  /**
   * Get subtopics for a topic
   */
  getTopicSubtopics: async (topicId: string): Promise<Tables<'subtopics'>[]> => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('subtopics')
        .select('*')
        .eq('topic_id', topicId)
        .order('number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<'subtopics'>[];
    } catch (error) {
      console.error('Error getting topic subtopics:', error);
      throw error;
    }
  },
}; 