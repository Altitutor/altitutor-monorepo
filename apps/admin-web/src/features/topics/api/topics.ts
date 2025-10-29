import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getNextTopicIndex, buildTopicTree, type TopicTree } from '../utils/codes';

/**
 * Topics API client for working with hierarchical topic data
 */
export const topicsApi = {
  /**
   * Get all topics
   */
  getAllTopics: async (): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching topics:', error);
      throw error;
    }
    
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
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching topic:', error);
      throw error;
    }
    
    return (data ?? null) as Tables<'topics'> | null;
  },
  
  /**
   * Get topics by subject ID
   */
  getTopicsBySubject: async (subjectId: string): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching topics by subject:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics'>[];
  },
  
  /**
   * Get child topics of a parent
   */
  getChildTopics: async (parentId: string): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .eq('parent_id', parentId)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching child topics:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics'>[];
  },
  
  /**
   * Get root topics (no parent) for a subject
   */
  getRootTopics: async (subjectId: string): Promise<Tables<'topics'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .is('parent_id', null)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Error fetching root topics:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics'>[];
  },
  
  /**
   * Get topic hierarchy tree for a subject
   */
  getTopicHierarchy: async (subjectId: string): Promise<TopicTree[]> => {
    const topics = await topicsApi.getTopicsBySubject(subjectId);
    return buildTopicTree(topics);
  },
  
  /**
   * Get ancestors of a topic (parent, grandparent, etc.)
   */
  getAncestors: async (topicId: string): Promise<Tables<'topics'>[]> => {
    const ancestors: Tables<'topics'>[] = [];
    const allTopics = await topicsApi.getAllTopics();
    
    let currentTopic = allTopics.find(t => t.id === topicId);
    
    while (currentTopic?.parent_id) {
      const parent = allTopics.find(t => t.id === currentTopic!.parent_id);
      if (parent) {
        ancestors.unshift(parent); // Add to beginning
        currentTopic = parent;
      } else {
        break;
      }
    }
    
    return ancestors;
  },
  
  /**
   * Create a new topic
   */
  createTopic: async (data: Omit<TablesInsert<'topics'>, 'index'>): Promise<Tables<'topics'>> => {
    const supabase = getSupabaseClient();
    
    // Get existing topics to calculate next index
    const { data: existing } = await supabase
      .from('topics')
      .select('*')
      .eq('subject_id', data.subject_id!);
    
    const index = getNextTopicIndex(
      data.subject_id!,
      data.parent_id ?? null,
      (existing ?? []) as Tables<'topics'>[]
    );
    
    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser();
    let createdBy: string | null = null;
    if (user?.id) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .single();
      createdBy = staff?.id || null;
    }
    
    const topicData: TablesInsert<'topics'> = {
      ...data,
      index,
      created_by: createdBy,
    };
    
    const { data: created, error } = await supabase
      .from('topics')
      .insert(topicData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
    
    return created as Tables<'topics'>;
  },
  
  /**
   * Update a topic
   */
  updateTopic: async (id: string, data: TablesUpdate<'topics'>): Promise<Tables<'topics'>> => {
    const supabase = getSupabaseClient();
    
    // Check if parent_id is being changed
    if (data.parent_id !== undefined) {
      // Get the current topic to check if parent is actually changing
      const { data: currentTopic, error: fetchError } = await supabase
        .from('topics')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If parent is changing, recalculate the index
      if (currentTopic && currentTopic.parent_id !== (data.parent_id || null)) {
        const newParentId = data.parent_id === 'none' ? null : (data.parent_id || null);
        
        // Get the next available index for the new parent
        // Note: .is() is only for null checks, use .eq() for UUID comparison
        let query = supabase
          .from('topics')
          .select('index')
          .eq('subject_id', currentTopic.subject_id);
        
        if (newParentId === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', newParentId);
        }
        
        const { data: siblingsData, error: siblingsError } = await query;
        
        if (siblingsError) throw siblingsError;
        
        const maxIndex = siblingsData && siblingsData.length > 0
          ? Math.max(...siblingsData.map((t: any) => t.index))
          : 0;
        
        // Set the new index
        data.index = maxIndex + 1;
      }
    }
    
    const { data: updated, error } = await supabase
      .from('topics')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating topic:', error);
      throw error;
    }
    
    return updated as Tables<'topics'>;
  },
  
  /**
   * Delete a topic (will cascade delete children)
   */
  deleteTopic: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('topics')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting topic:', error);
      throw error;
    }
  },
  
  /**
   * Batch update topic indices (for reordering)
   */
  updateTopicIndices: async (updates: Array<{ id: string; index: number }>): Promise<void> => {
    const supabase = getSupabaseClient();
    
    // Use RPC function to update indices atomically
    const { error } = await supabase.rpc('batch_update_topic_indices', {
      updates: updates as any
    });
    
    if (error) {
      console.error('Failed to update topic indices:', error);
      throw new Error('Failed to update topic indices');
    }
  },
  
  /**
   * Get topics with their related subject information
   */
  getTopicsWithSubjects: async (): Promise<{
    topics: Tables<'topics'>[];
    subjectByTopicId: Record<string, Tables<'subjects'>>;
  }> => {
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
        `)
        .order('index', { ascending: true });
      
      if (error) {
        console.error('Error fetching topics with subjects:', error);
        throw error;
      }
      
      const topics = (data ?? []) as any[];
      const subjectByTopicId: Record<string, Tables<'subjects'>> = {};
      
      topics.forEach((t: any) => {
        if (t.subjects) {
          subjectByTopicId[t.id] = t.subjects as Tables<'subjects'>;
        }
      });
      
      return {
        topics: topics as Tables<'topics'>[],
        subjectByTopicId,
      };
    } catch (error) {
      console.error('Error in getTopicsWithSubjects:', error);
      throw error;
    }
  },
};
