import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Topics API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_topics)
 * All writes (create/update topics and topic files) must go through API routes:
 * - POST /api/topics
 * - PATCH /api/topics/[id]
 * - POST /api/topics-files
 * - PATCH /api/topics-files/[id]
 */
export const topicsApi = {
  /**
   * Get all topics accessible to the current tutor.
   * Uses vtutor_topics view.
   */
  getAllTopics: async () => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching topics:', error);
      throw error;
    }
    
    return data ?? [];
  },
  
  /**
   * Get a topic by ID.
   * Uses vtutor_topics view.
   */
  getTopic: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching topic:', error);
      throw error;
    }
    
    return data ?? null;
  },
  
  /**
   * Get topics by subject ID.
   * Uses vtutor_topics view.
   */
  getTopicsBySubject: async (subjectId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching topics by subject:', error);
      throw error;
    }
    
    return data ?? [];
  },
  
  /**
   * Get child topics of a parent.
   * Uses vtutor_topics view.
   */
  getChildTopics: async (parentId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('parent_id', parentId)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching child topics:', error);
      throw error;
    }
    
    return data ?? [];
  },
  
  /**
   * Get root topics (no parent) for a subject.
   * Uses vtutor_topics view.
   */
  getRootTopics: async (subjectId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('subject_id', subjectId)
      .is('parent_id', null)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching root topics:', error);
      throw error;
    }
    
    return data ?? [];
  },

  /**
   * Get the full topic hierarchy for a subject, including files.
   * Note: This is a simplified version - vtutor_subject_resources might not be available in types.
   * For now, we'll use vtutor_topics and fetch files separately.
   */
  getTopicHierarchy: async (subjectId: string) => {
    // Use getTopicsBySubject for now - files would need to be fetched separately
    return await topicsApi.getTopicsBySubject(subjectId);
  },
};
