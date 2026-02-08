import { getSupabaseClient } from './client';

/**
 * Storage helper functions for managing files in Supabase Storage
 * 
 * Session Files: /session_id/timestamp_filename
 */

export interface UploadFileResult {
  path: string;
  url: string;
}

/**
 * Session Files Storage Helpers
 * For managing files in the session-files bucket
 */

export interface UploadSessionFileOptions {
  sessionId: string;
  file: File;
}

/**
 * Upload a file to the session-files bucket
 * Path format: {sessionId}/{timestamp}_{filename}
 */
export async function uploadSessionFile({ sessionId, file }: UploadSessionFileOptions): Promise<UploadFileResult> {
  const supabase = getSupabaseClient();
  
  // Generate a unique filename to avoid collisions
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${sessionId}/${timestamp}_${sanitizedFilename}`;
  
  // Upload file to storage
  const { data, error } = await supabase.storage
    .from('session-files')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    const errorWithDetails = error as { message: string; statusCode?: number; code?: string };
    console.error('Storage upload error:', {
      error,
      message: error.message,
      statusCode: errorWithDetails.statusCode,
      errorCode: errorWithDetails.code,
      path,
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    throw error; // Throw the original error so we can inspect it
  }
  
  // Get public URL (will require authentication to access due to bucket policies)
  const { data: urlData } = supabase.storage
    .from('session-files')
    .getPublicUrl(path);
  
  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Get a signed URL for a session file (valid for specified duration, default 1 hour)
 */
export async function getSessionFileSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('session-files')
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error('Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Delete a session file from storage
 */
export async function deleteSessionFile(path: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.storage
    .from('session-files')
    .remove([path]);
  
  if (error) {
    console.error('Failed to delete file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Update a session file (delete old + upload new)
 */
export async function updateSessionFile({ oldPath, sessionId, file }: { oldPath: string; sessionId: string; file: File }): Promise<UploadFileResult> {
  // Delete old file
  await deleteSessionFile(oldPath);
  
  // Upload new file
  return uploadSessionFile({ sessionId, file });
}

/**
 * Download a session file
 */
export async function downloadSessionFile(path: string): Promise<Blob> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('session-files')
    .download(path);
  
  if (error) {
    console.error('Failed to download file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  return data;
}

/**
 * List files for a session
 */
export async function listSessionFiles(sessionId: string): Promise<Array<{ name: string; id: string }>> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from('session-files')
    .list(sessionId);
  
  if (error) {
    console.error('Failed to list files:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
  
  return data || [];
}

