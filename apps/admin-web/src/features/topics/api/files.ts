import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadFile as uploadToStorage, getSignedUrl as getStorageSignedUrl } from '@/shared/lib/supabase/storage';

/**
 * Files API for managing file metadata and storage
 */

export const filesApi = {
  /**
   * Upload a file and create a database record
   */
  uploadFile: async (params: {
    subjectId: string;
    topicId: string;
    file: File;
  }): Promise<Tables<'files'>> => {
    const supabase = getSupabaseClient();
    
    // Upload to storage
    const { path, url } = await uploadToStorage({
      subjectId: params.subjectId,
      topicId: params.topicId,
      file: params.file,
    });
    
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
    
    // Create database record
    const fileData: TablesInsert<'files'> = {
      mimetype: params.file.type,
      filename: params.file.name,
      size_bytes: params.file.size,
      metadata: {
        originalName: params.file.name,
        uploadedAt: new Date().toISOString(),
      },
      storage_provider: 'supabase',
      bucket: 'resources',
      storage_path: path,
      created_by: createdBy,
    };
    
    const { data: created, error } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create file record:', error);
      throw error;
    }
    
    return created as Tables<'files'>;
  },
  
  /**
   * Get a file by ID
   */
  getFile: async (id: string): Promise<Tables<'files'> | null> => {
    const { data, error } = await getSupabaseClient()
      .from('files')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get file:', error);
      throw error;
    }
    
    return (data ?? null) as Tables<'files'> | null;
  },
  
  /**
   * Get file with signed URL for download/preview
   */
  getFileWithSignedUrl: async (id: string): Promise<{
    file: Tables<'files'>;
    signedUrl: string;
  } | null> => {
    const file = await filesApi.getFile(id);
    
    if (!file) {
      return null;
    }
    
    const signedUrl = await getStorageSignedUrl(file.storage_path);
    
    return {
      file,
      signedUrl,
    };
  },
  
  /**
   * Soft delete a file (set deleted_at)
   */
  softDeleteFile: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('files')
      .update({ deleted_at: new Date().toISOString() } as TablesUpdate<'files'>)
      .eq('id', id);
    
    if (error) {
      console.error('Failed to soft delete file:', error);
      throw error;
    }
  },
  
  /**
   * Restore a soft-deleted file
   */
  restoreFile: async (id: string): Promise<void> => {
    const { error } = await getSupabaseClient()
      .from('files')
      .update({ deleted_at: null } as TablesUpdate<'files'>)
      .eq('id', id);
    
    if (error) {
      console.error('Failed to restore file:', error);
      throw error;
    }
  },
  
  /**
   * Get all files (optionally including soft-deleted)
   */
  getAllFiles: async (includeSoftDeleted = false): Promise<Tables<'files'>[]> => {
    let query = getSupabaseClient()
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!includeSoftDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to get files:', error);
      throw error;
    }
    
    return (data ?? []) as Tables<'files'>[];
  },
};

