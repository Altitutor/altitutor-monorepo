import { getSupabaseClient } from './client';

/**
 * Storage helper functions for managing files in Supabase Storage
 * 
 * Folder structure: /subject_id/topic_id/filename
 */

export interface UploadFileOptions {
  subjectId: string;
  topicId: string;
  file: File;
}

export interface UploadFileResult {
  path: string;
  url: string;
}

/**
 * Upload a file to the resources bucket
 */
export async function uploadFile({ subjectId, topicId, file }: UploadFileOptions): Promise<UploadFileResult> {
  const supabase = getSupabaseClient();
  
  // Generate a unique filename to avoid collisions
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${subjectId}/${topicId}/${timestamp}_${sanitizedFilename}`;
  
  // Upload file to storage
  const { data, error } = await supabase.storage
    .from('resources')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  // Get public URL (will require authentication to access due to bucket policies)
  const { data: urlData } = supabase.storage
    .from('resources')
    .getPublicUrl(path);
  
  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Get a signed URL for a file (valid for 1 hour)
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error('Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Delete a file from storage (typically used when soft-deleting from database)
 * Note: We generally don't delete files immediately; use soft delete instead
 */
export async function deleteFile(path: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.storage
    .from('resources')
    .remove([path]);
  
  if (error) {
    console.error('Failed to delete file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Download a file
 */
export async function downloadFile(path: string): Promise<Blob> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('resources')
    .download(path);
  
  if (error) {
    console.error('Failed to download file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  return data;
}

/**
 * List files in a folder
 */
export async function listFiles(folderPath: string): Promise<Array<{ name: string; id: string }>> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('resources')
    .list(folderPath);
  
  if (error) {
    console.error('Failed to list files:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
  
  return data || [];
}

