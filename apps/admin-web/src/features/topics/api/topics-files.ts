import type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { deleteFile as deleteStorageFile } from '@/shared/lib/supabase/storage';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Topics Files API for managing the link between topics and files
 */

export const topicsFilesApi = {
  /**
   * Create a topic file link
   */
  createTopicFile: async (data: Omit<TablesInsert<'topics_files'>, 'index' | 'code'>): Promise<Tables<'topics_files'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
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
    const topicFileData: Omit<TablesInsert<'topics_files'>, 'code' | 'index'> = {
      ...data,
      created_by: createdBy,
    };
    
    const { data: created, error } = await supabase
      .from('topics_files')
      .insert(topicFileData as TablesInsert<'topics_files'>) // index is calculated by database trigger
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
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
   * Get topic file with file and topic details by file ID
   */
  getTopicFileByFileId: async (fileId: string): Promise<(Tables<'topics_files'> & { file: Tables<'files'>, topic: Tables<'topics'> }) | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data, error } = await supabase
      .from('topics_files')
      .select(`
        *,
        file:files(*),
        topic:topics(*)
      `)
      .eq('file_id', fileId)
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get topic file by file ID:', error);
      throw error;
    }
    
    return (data ?? null) as (Tables<'topics_files'> & { file: Tables<'files'>; topic: Tables<'topics'> }) | null;
  },
  
  /**
   * Get all topic files for a topic with file details
   */
  getTopicFilesByTopic: async (topicId: string): Promise<Array<Tables<'topics_files'> & { file: Tables<'files'> }>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
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
    
    return (data ?? []) as Array<Tables<'topics_files'> & { file: Tables<'files'> }>;
  },
  
  /**
   * Get topic files by type
   */
  getTopicFilesByType: async (
    topicId: string,
    type: Enums<'resource_type'>
  ): Promise<Tables<'topics_files'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
  ): Promise<Array<Tables<'topics_files'> & { file: Tables<'files'> }>> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('topics_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('topic_id', topicId)
      .eq('type', type)
      .eq('is_solutions', false)
      .order('index', { ascending: true });
    
    if (error) {
      console.error('Failed to get available solution links:', error);
      throw error;
    }
    
    return (data ?? []) as Array<Tables<'topics_files'> & { file: Tables<'files'> }>;
  },
  
  /**
   * Update a topic file
   */
  updateTopicFile: async (id: string, data: TablesUpdate<'topics_files'>): Promise<Tables<'topics_files'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // If topic_id or type is changing, we need to recalculate the index
    if (data.topic_id || data.type !== undefined) {
      // First get the current topic file
      const { error: fetchError } = await supabase
        .from('topics_files')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error('Failed to fetch current topic file:', fetchError);
        throw fetchError;
      }
      
      // Check if topic, type, or solutions status changed
      // Don't set index - database triggers will recalculate siblings automatically
      // when topic_id, type, or is_solutions changes
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
   * Delete a topic file (and associated file record and storage file)
   */
  deleteTopicFile: async (id: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // First, get the topic file with file details
    const { data: topicFile, error: fetchError } = await supabase
      .from('topics_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Failed to fetch topic file:', fetchError);
      throw fetchError;
    }
    
    if (!topicFile) {
      throw new Error('Topic file not found');
    }
    
    const file = (topicFile as { file?: Tables<'files'> | null }).file ?? null;
    
    // Delete the topics_files record
    const { error: deleteTopicFileError } = await supabase
      .from('topics_files')
      .delete()
      .eq('id', id);
    
    if (deleteTopicFileError) {
      console.error('Failed to delete topic file:', deleteTopicFileError);
      throw deleteTopicFileError;
    }
    
    // Delete the file record from database
    if (file?.id) {
      const { error: deleteFileError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);
      
      if (deleteFileError) {
        console.error('Failed to delete file record:', deleteFileError);
        // Continue even if file record deletion fails - storage deletion is more critical
      }
    }
    
    // Delete the file from storage
    if (file?.storage_path) {
      try {
        await deleteStorageFile(file.storage_path);
      } catch (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // Don't throw - database records are already deleted
        // Storage cleanup can be done manually if needed
      }
    }
  },
  
  /**
   * Batch update topic file indices (for reordering)
   * Uses RPC function to update indices atomically and avoid unique constraint violations
   */
  updateTopicFileIndices: async (updates: Array<{ id: string; index: number }>): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // Use RPC function to update indices atomically (two-pass approach to avoid conflicts)
    const { error } = await supabase.rpc('batch_update_topic_file_indices', {
      updates: updates as Array<{ id: string; index: number }>
    });
    
    if (error) {
      console.error('Failed to update topic file indices:', error);
      throw error;
    }
  },
  
  /**
   * Get all topic files (for admin/debug purposes)
   */
  getAllTopicFiles: async (): Promise<Tables<'topics_files'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('topics_files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to get all topic files:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'topics_files'>[];
  },

  /**
   * Search files using search_files_admin RPC
   * Returns files with topic and subject relationships
   */
  searchFiles: async (params: {
    search?: string;
    subjectIds?: string[];
    topicIds?: string[];
    fileTypes?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    files: Array<{
      id: string;
      topic_id: string;
      type: string;
      index: number;
      code: string | null;
      file_id: string;
      file: {
        id: string;
        filename: string;
        mimetype: string | null;
        size_bytes: number | null;
      };
      topic: {
        id: string;
        name: string;
        code: string | null;
      };
      subject: {
        id: string;
        name: string;
        short_name: string | null;
        long_name: string | null;
      };
    }>;
    total: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data, error } = await supabase.rpc('search_files_admin', {
      p_search: params.search?.trim() || undefined,
      p_subject_ids: params.subjectIds && params.subjectIds.length > 0 ? params.subjectIds : undefined,
      p_topic_ids: params.topicIds && params.topicIds.length > 0 ? params.topicIds : undefined,
      p_file_types: params.fileTypes && params.fileTypes.length > 0 ? params.fileTypes : undefined,
      p_limit: params.limit ?? 20,
      p_offset: params.offset ?? 0,
    });
    
    if (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
    
    const result = data as {
      files: Array<{
        id: string;
        topic_id: string;
        type: string;
        index: number;
        code: string | null;
        file_id: string;
        file: {
          id: string;
          filename: string;
          mimetype: string | null;
          size_bytes: number | null;
        };
        topic: {
          id: string;
          name: string;
          code: string | null;
        };
        subject: {
          id: string;
          name: string;
          short_name: string | null;
          long_name: string | null;
        };
      }>;
      total: number;
    } | null;
    
    return {
      files: result?.files ?? [],
      total: result?.total ?? 0,
    };
  },
};

