import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/**
 * Topics API client for working with topic and subtopic data
 */
export const topicsApi = {
  /**
   * Get all topics
   */
  getAllTopics: async (): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*');
    if (error) throw error;
    return (data ?? []) as Tables<'topics'>[];
  },
  
  /**
   * Get a topic by ID
   */
  getTopic: async (id: string): Promise<Tables<'topics'> | null> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'topics'> | null;
  },
  
  /**
   * Create a new topic
   */
  createTopic: async (data: TablesInsert<'topics'>): Promise<Tables<'topics'>> => {
    const { data: created, error } = await getSupabaseClient()
      .from('topics')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'topics'>;
  },
  
  /**
   * Update a topic
   */
  updateTopic: async (id: string, data: TablesUpdate<'topics'>): Promise<Tables<'topics'>> => {
    const { data: updated, error } = await getSupabaseClient()
      .from('topics')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Tables<'topics'>;
  },
  
  /**
   * Delete a topic
   */
  deleteTopic: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('topics')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Direct query to get all topics (bypassing repository)
   * This is a fallback in case the repository approach fails
   */
  directGetAllTopics: async (): Promise<Tables<'topics'>[]> => {
    return topicsApi.getAllTopics();
  },

  /**
   * Get all topics for a specific subject
   */
  getTopicsBySubject: async (subjectId: string): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('number', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Tables<'topics'>[];
  },

  /**
   * Get all subtopics for a topic
   */
  getSubtopicsByTopic: async (topicId: string): Promise<Tables<'subtopics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('subtopics')
      .select('*')
      .eq('topic_id', topicId)
      .order('number', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Tables<'subtopics'>[];
  },

  /**
   * Get a subtopic by ID
   */
  getSubtopic: async (id: string): Promise<Tables<'subtopics'> | null> => {
    const { data, error } = await getSupabaseClient()
      .from('subtopics')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'subtopics'> | null;
  },

  /**
   * Create a new subtopic
   */
  createSubtopic: async (data: TablesInsert<'subtopics'>): Promise<Tables<'subtopics'>> => {
    const { data: created, error } = await getSupabaseClient()
      .from('subtopics')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'subtopics'>;
  },

  /**
   * Update a subtopic
   */
  updateSubtopic: async (id: string, data: TablesUpdate<'subtopics'>): Promise<Tables<'subtopics'>> => {
    const { data: updated, error } = await getSupabaseClient()
      .from('subtopics')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Tables<'subtopics'>;
  },

  /**
   * Delete a subtopic
   */
  deleteSubtopic: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('subtopics')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Get topics with their related subject information
   */
  getTopicsWithSubjects: async (): Promise<{ topics: Tables<'topics'>[]; subjectByTopicId: Record<string, Tables<'subjects'>> }> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('topics')
        .select(`
          *,
          subjects:subject_id (
            id,
            name,
            curriculum,
            discipline,
            level,
            year_level
          )
        `);
      
      if (error) {
        console.error('Error fetching topics with subjects:', error);
        throw error;
      }
      
      const topics = (data ?? []) as any[];
      const subjectByTopicId: Record<string, Tables<'subjects'>> = {};
      topics.forEach((t: any) => {
        if (t.subjects) subjectByTopicId[t.id] = t.subjects as Tables<'subjects'>;
      });
      return { topics: topics as Tables<'topics'>[], subjectByTopicId };
    } catch (error) {
      console.error('Error in getTopicsWithSubjects:', error);
      throw error;
    }
  },

  /**
   * Get all subtopics with their related topic information
   */
  getAllSubtopicsWithTopics: async (): Promise<{ subtopics: Tables<'subtopics'>[]; topicBySubtopicId: Record<string, Tables<'topics'>> }> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('subtopics')
        .select(`
          *,
          topics:topic_id (
            id,
            name,
            subject_id,
            number,
            area
          )
        `);
      
      if (error) {
        console.error('Error fetching subtopics with topics:', error);
        throw error;
      }
      
      const subtopics = (data ?? []) as any[];
      const topicBySubtopicId: Record<string, Tables<'topics'>> = {};
      subtopics.forEach((s: any) => {
        if (s.topics) topicBySubtopicId[s.id] = s.topics as Tables<'topics'>;
      });
      return { subtopics: subtopics as Tables<'subtopics'>[], topicBySubtopicId };
    } catch (error) {
      console.error('Error in getAllSubtopicsWithTopics:', error);
      throw error;
    }
  }
}; 