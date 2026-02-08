import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { buildTopicTree, type TopicTree } from '../utils/codes';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Topics API client for working with hierarchical topic data
 */
export const topicsApi = {
  /**
   * Get all topics
   */
  getAllTopics: async (): Promise<Tables<'topics'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
  createTopic: async (data: Omit<TablesInsert<'topics'>, 'index' | 'code'>): Promise<Tables<'topics'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
    
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
    
    // Index will be auto-calculated by database trigger
    const topicData: Omit<TablesInsert<'topics'>, 'code' | 'index'> = {
      ...data,
      created_by: createdBy,
    };
    
    const { data: created, error } = await supabase
      .from('topics')
      .insert(topicData as any) // index is calculated by database trigger
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
   * Note: Index recalculation is handled by database triggers when parent_id changes
   */
  updateTopic: async (id: string, data: TablesUpdate<'topics'>): Promise<Tables<'topics'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
    
    // Handle 'none' parent_id value (convert to null)
    if (data.parent_id === 'none') {
      data.parent_id = null;
    }
    
    // Don't set index - database triggers will recalculate siblings automatically
    // when parent_id changes. The BEFORE UPDATE trigger will handle index recalculation
    // to prevent unique constraint violations.
    
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
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
    
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
   * Search topics with server-side filtering and pagination
   * Uses search_topics_admin RPC function
   */
  search: async (params: {
    search?: string;
    subjectIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    topics: Array<Tables<'topics'> & { subject: Tables<'subjects'> }>;
    total: number;
  }> => {
    const {
      search = '',
      subjectIds,
      limit = 20,
      offset = 0,
    } = params || {};

    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const trimmed = search.trim();

    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_topics_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_subject_ids: subjectIds && subjectIds.length > 0 ? subjectIds : undefined,
      p_limit: limit,
      p_offset: offset,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { topics: [], total: 0 };

    const rpcData = rpcResult as { topics: any[]; total: number };
    return {
      topics: (rpcData.topics || []) as Array<Tables<'topics'> & { subject: Tables<'subjects'> }>,
      total: rpcData.total ?? 0,
    };
  },

  /**
   * Get topics with their related subject information
   */
  getTopicsWithSubjects: async (): Promise<{
    topics: Tables<'topics'>[];
    subjectByTopicId: Record<string, Tables<'subjects'>>;
  }> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>) as SupabaseClient<Database>;
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
