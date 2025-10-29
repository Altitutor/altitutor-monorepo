import type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getNextTopicFileIndex } from '../utils/codes';

/**
 * Topics Files API for managing the link between topics and files
 */

export const topicsFilesApi = {
  /**
   * Create a topic file link
   */
  createTopicFile: async (data: Omit<TablesInsert<'topics_files'>, 'index'>): Promise<Tables<'topics_files'>> => {
    const supabase = getSupabaseClient();
    
    // Get existing topic files to calculate next index
    const { data: existing } = await supabase
      .from('topics_files')
      .select('*')
      .eq('topic_id', data.topic_id!);
    
    const index = getNextTopicFileIndex(
      data.topic_id!,
      data.type!,
      data.is_solutions ?? false,
      (existing ?? []) as Tables<'topics_files'>[]
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
    
    const topicFileData: TablesInsert<'topics_files'> = {
      ...data,
      index,
      created_by: createdBy,
    };
    
    const { data: created, error } = await supabase
      .from('topics_files')
      .insert(topicFileData)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create topic file:', error);
      throw error;
    }
    
    return created as Tables<'topics_files'>;
  },
  
  /**
   * Get a topic file by ID
   */
  getTopicFile: async (id: string): Promise<Tables<'topics_files'> | null> => {
    const { data, error } = await getSupabaseClient()
      .from('topics_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get topic file:', error);
      throw error;
    }
    
    return (data ?? null) as Tables<'topics_files'> | null;
  },
  
  /**
   * Get all topic files for a topic with file details
   */
  getTopicFilesByTopic: async (topicId: string): Promise<Array<Tables<'topics_files'> & { file: Tables<'files'> }>> => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('topics_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('topic_id', topicId)
      .order('type', { ascending: true })
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Failed to get topic files:', error);
      throw error;
    }
    
    return (data ?? []) as any[];
  },
  
  /**
   * Get topic files by type
   */
  getTopicFilesByType: async (
    topicId: string,
    type: Enums<'resource_type'>
  ): Promise<Tables<'topics_files'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .eq('type', type)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Failed to get topic files by type:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics_files'>[];
  },
  
  /**
   * Get solution files that can be linked (for a given topic, type)
   */
  getAvailableSolutionLinks: async (
    topicId: string,
    type: Enums<'resource_type'>
  ): Promise<Tables<'topics_files'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .eq('type', type)
      .eq('is_solutions', false)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Failed to get available solution links:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics_files'>[];
  },
  
  /**
   * Update a topic file
   */
  updateTopicFile: async (id: string, data: TablesUpdate<'topics_files'>): Promise<Tables<'topics_files'>> => {
    const supabase = getSupabaseClient();
    
    // If topic_id or type is changing, we need to recalculate the index
    if (data.topic_id || data.type !== undefined) {
      // First get the current topic file
      const { data: currentFile, error: fetchError } = await supabase
        .from('topics_files')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error('Failed to fetch current topic file:', fetchError);
        throw fetchError;
      }
      
      // Determine the new topic_id and type (use provided or existing)
      const newTopicId = data.topic_id || currentFile.topic_id;
      const newType = data.type !== undefined ? data.type : currentFile.type;
      const newIsSolutions = data.is_solutions !== undefined ? data.is_solutions : currentFile.is_solutions;
      
      // Check if topic, type, or solutions status changed
      const topicChanged = data.topic_id && data.topic_id !== currentFile.topic_id;
      const typeChanged = data.type !== undefined && data.type !== currentFile.type;
      const solutionsChanged = data.is_solutions !== undefined && data.is_solutions !== currentFile.is_solutions;
      
      if (topicChanged || typeChanged || solutionsChanged) {
        // Get the next index for the new combination
        const nextIndex = await topicsFilesApi.getNextTopicFileIndex(newTopicId, newIsSolutions);
        data.index = nextIndex;
      }
    }
    
    const { data: updated, error } = await supabase
      .from('topics_files')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to update topic file:', error);
      throw error;
    }
    
    return updated as Tables<'topics_files'>;
  },
  
  /**
   * Delete a topic file
   */
  deleteTopicFile: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('topics_files')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Failed to delete topic file:', error);
      throw error;
    }
  },
  
  /**
   * Batch update topic file indices (for reordering)
   */
  updateTopicFileIndices: async (updates: Array<{ id: string; index: number }>): Promise<void> => {
    const supabase = getSupabaseClient();
    
    // Update each topic file's index
    const promises = updates.map(({ id, index }) =>
      supabase
        .from('topics_files')
        .update({ index } as TablesUpdate<'topics_files'>)
        .eq('id', id)
    );
    
    const results = await Promise.all(promises);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Failed to update topic file indices:', errors);
      throw new Error('Failed to update some topic file indices');
    }
  },
  
  /**
   * Get all topic files (for admin/debug purposes)
   */
  getAllTopicFiles: async (): Promise<Tables<'topics_files'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('topics_files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to get all topic files:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics_files'>[];
  },
};

