import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadSessionFile, deleteSessionFile, getSessionFileSignedUrl } from '@/shared/lib/supabase/storage';
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
   * Upload a file for a session and create database records
   */
  uploadSessionFile: async (params: {
    sessionId: string;
    file: File;
    displayOrder?: number;
  }): Promise<Tables<'sessions_files'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get current student ID (for created_by, though it will be NULL for students)
    const { data: studentId } = await supabase.rpc('current_student_id');
    
    // Upload to storage
    const { path } = await uploadSessionFile({
      sessionId: params.sessionId,
      file: params.file,
    });
    
    // Create file database record
    const fileData: TablesInsert<'files'> = {
      mimetype: params.file.type,
      filename: params.file.name,
      size_bytes: params.file.size,
      metadata: {
        originalName: params.file.name,
        uploadedAt: new Date().toISOString(),
      },
      storage_provider: 'supabase',
      bucket: 'session-files',
      storage_path: path,
      created_by: null, // Students don't have staff ID
    };
    
    const { data: createdFile, error: fileError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();
    
    if (fileError) {
      // Clean up storage file if database insert fails
      try {
        await deleteSessionFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage file after database error:', cleanupError);
      }
      console.error('Failed to create file record:', fileError);
      throw fileError;
    }
    
    // Create sessions_files link
    const sessionFileData: TablesInsert<'sessions_files'> = {
      session_id: params.sessionId,
      file_id: createdFile.id,
      display_order: params.displayOrder ?? 0,
      created_by: null, // Students don't have staff ID
    };
    
    const { data: createdSessionFile, error: sessionFileError } = await supabase
      .from('sessions_files')
      .insert(sessionFileData)
      .select()
      .single();
    
    if (sessionFileError) {
      // Clean up file record and storage if link creation fails
      try {
        await supabase.from('files').delete().eq('id', createdFile.id);
        await deleteSessionFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup after session_file link error:', cleanupError);
      }
      console.error('Failed to create session_file link:', sessionFileError);
      throw sessionFileError;
    }
    
    return createdSessionFile as Tables<'sessions_files'>;
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
      (data || []).map(async (sessionFile: any) => {
        const file = sessionFile.file as Tables<'files'>;
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
    
    const file = (sessionFile as any).file as { storage_path: string };
    
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

