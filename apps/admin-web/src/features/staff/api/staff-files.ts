import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadStaffFile, deleteStaffFile, getStaffFileSignedUrl } from '@/shared/lib/supabase/storage';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff Files API for managing files linked to staff
 */

export interface StaffFileWithUrl extends Tables<'staff_files'> {
  file: Tables<'files'>;
  signedUrl: string;
}

export const staffFilesApi = {
  /**
   * Upload a file for a staff member and create database records
   */
  uploadStaffFile: async (params: {
    staffId: string;
    file: File;
    displayOrder?: number;
  }): Promise<Tables<'staff_files'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get current staff ID for created_by
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    const createdBy = staff?.id || null;
    
    // Upload to storage
    const { path } = await uploadStaffFile({
      staffId: params.staffId,
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
      bucket: 'staff-files',
      storage_path: path,
      created_by: createdBy,
    };
    
    const { data: createdFile, error: fileError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();
    
    if (fileError) {
      // Clean up storage file if database insert fails
      try {
        await deleteStaffFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage file after database error:', cleanupError);
      }
      console.error('Failed to create file record:', fileError);
      throw fileError;
    }
    
    // Create staff_files link
    const staffFileData: TablesInsert<'staff_files'> = {
      staff_id: params.staffId,
      file_id: createdFile.id,
      display_order: params.displayOrder ?? 0,
      created_by: createdBy,
    };
    
    const { data: createdStaffFile, error: staffFileError } = await supabase
      .from('staff_files')
      .insert(staffFileData)
      .select()
      .single();
    
    if (staffFileError) {
      // Clean up file record and storage if link creation fails
      try {
        await supabase.from('files').delete().eq('id', createdFile.id);
        await deleteStaffFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup after staff_file link error:', cleanupError);
      }
      console.error('Failed to create staff_file link:', staffFileError);
      throw staffFileError;
    }
    
    return createdStaffFile as Tables<'staff_files'>;
  },

  /**
   * Get all files for a staff member with signed URLs
   */
  getStaffFiles: async (staffId: string): Promise<StaffFileWithUrl[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('staff_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('staff_id', staffId)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Failed to get staff files:', error);
      throw error;
    }
    
    // Get signed URLs for each file
    const filesWithUrls = await Promise.all(
      (data || []).map(async (staffFile: any) => {
        const file = staffFile.file as Tables<'files'>;
        const signedUrl = await getStaffFileSignedUrl(file.storage_path);
        
        return {
          ...staffFile,
          file,
          signedUrl,
        } as StaffFileWithUrl;
      })
    );
    
    return filesWithUrls;
  },

  /**
   * Rename a staff file (updates display_name)
   */
  renameStaffFile: async (staffFileId: string, displayName: string): Promise<Tables<'staff_files'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('staff_files')
      .update({ display_name: displayName.trim() || null })
      .eq('id', staffFileId)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to rename staff file:', error);
      throw error;
    }
    
    return data as Tables<'staff_files'>;
  },

  /**
   * Delete a staff file (removes from storage and database)
   */
  deleteStaffFile: async (staffFileId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get file record to get storage path
    const { data: staffFile, error: staffFileError } = await supabase
      .from('staff_files')
      .select('file:files(storage_path)')
      .eq('id', staffFileId)
      .single();
    
    if (staffFileError) {
      console.error('Failed to get staff file:', staffFileError);
      throw staffFileError;
    }
    
    const file = (staffFile as any).file as { storage_path: string };
    
    // Delete from storage first
    try {
      await deleteStaffFile(file.storage_path);
    } catch (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
    
    // Delete staff_files link (file will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('staff_files')
      .delete()
      .eq('id', staffFileId);
    
    if (deleteError) {
      console.error('Failed to delete staff file link:', deleteError);
      throw deleteError;
    }
  },
};
