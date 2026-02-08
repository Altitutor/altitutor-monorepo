import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { deleteSessionFile, getSessionFileSignedUrl } from '@/shared/lib/supabase/storage';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Session Files API for managing files linked to sessions
 */

export interface SessionFileWithUrl extends Tables<'sessions_files'> {
  file: Tables<'files'>;
  signedUrl: string;
}

export const sessionFilesApi = {
  /**
   * Upload a file for a session via API route
   * Uses API route to handle database writes (following pattern: students write through API)
   */
  uploadSessionFile: async (params: {
    sessionId: string;
    file: File;
    displayOrder?: number;
  }): Promise<Tables<'sessions_files'>> => {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', params.file);
    if (params.displayOrder !== undefined) {
      formData.append('displayOrder', params.displayOrder.toString());
    }

    // Call API route
    const response = await fetch(`/api/sessions/${params.sessionId}/files`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to upload file: ${response.statusText}`);
    }

    const result = await response.json();
    return result.sessionFile as Tables<'sessions_files'>;
  },

  /**
   * Get all files for a session with signed URLs
   */
  getSessionFiles: async (sessionId: string): Promise<SessionFileWithUrl[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('sessions_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('session_id', sessionId)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Failed to get session files:', error);
      throw error;
    }
    
    // Get signed URLs for each file
    const filesWithUrls = await Promise.all(
      (data || []).map(async (sessionFile: Tables<'sessions_files'> & { file: Tables<'files'> }) => {
        const file = sessionFile.file;
        const signedUrl = await getSessionFileSignedUrl(file.storage_path);
        
        return {
          ...sessionFile,
          file,
          signedUrl,
        } as SessionFileWithUrl;
      })
    );
    
    return filesWithUrls;
  },

  /**
   * Delete a session file (removes from storage and database)
   */
  deleteSessionFile: async (fileId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get file record to get storage path
    const { data: sessionFile, error: sessionFileError } = await supabase
      .from('sessions_files')
      .select('file:files(storage_path)')
      .eq('file_id', fileId)
      .single();
    
    if (sessionFileError) {
      console.error('Failed to get session file:', sessionFileError);
      throw sessionFileError;
    }
    
    const file = (sessionFile as { file: { storage_path: string } }).file;
    
    // Delete from storage first
    try {
      await deleteSessionFile(file.storage_path);
    } catch (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
    
    // Delete sessions_files link (file will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('sessions_files')
      .delete()
      .eq('file_id', fileId);
    
    if (deleteError) {
      console.error('Failed to delete session file link:', deleteError);
      throw deleteError;
    }
  },

  /**
   * Update display order of files in a session
   */
  updateFileDisplayOrder: async (sessionFileId: string, displayOrder: number): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('sessions_files')
      .update({ display_order: displayOrder })
      .eq('id', sessionFileId);
    
    if (error) {
      console.error('Failed to update file display order:', error);
      throw error;
    }
  },
};

