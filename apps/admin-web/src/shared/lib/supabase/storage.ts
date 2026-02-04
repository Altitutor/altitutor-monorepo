import { getSupabaseClient } from './client';

/**
 * Storage helper functions for managing files in Supabase Storage
 * 
 * Folder structure: /subject_id/topic_id/filename
 */

export type StorageBucket = 'resources' | 'session-files' | 'staff-files' | 'student-files';

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
 * Generic bucket-based storage functions
 */

/**
 * Upload a file to a specific bucket
 */
export async function uploadToBucket(
  bucket: StorageBucket,
  path: string,
  file: File
): Promise<UploadFileResult> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from(bucket)
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
    .from(bucket)
    .getPublicUrl(path);
  
  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Get a signed URL for a file from a specific bucket
 */
export async function getSignedUrlFromBucket(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error('Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Delete a file from a specific bucket
 */
export async function deleteFromBucket(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) {
    console.error('Failed to delete file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Upload a file to the resources bucket
 * Convenience wrapper for backward compatibility
 */
export async function uploadFile({ subjectId, topicId, file }: UploadFileOptions): Promise<UploadFileResult> {
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${subjectId}/${topicId}/${timestamp}_${sanitizedFilename}`;
  
  return uploadToBucket('resources', path, file);
}

/**
 * Get a signed URL for a file from the resources bucket (valid for 1 hour)
 * Convenience wrapper for backward compatibility
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  return getSignedUrlFromBucket('resources', path, expiresIn);
}

/**
 * Delete a file from the resources bucket
 * Note: We generally don't delete files immediately; use soft delete instead
 * Convenience wrapper for backward compatibility
 */
export async function deleteFile(path: string): Promise<void> {
  return deleteFromBucket('resources', path);
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

/**
 * Session Files Storage Functions
 */

export interface UploadSessionFileOptions {
  sessionId: string;
  file: File;
}

/**
 * Upload a file to the session-files bucket
 * Path format: {sessionId}/{timestamp}_{filename}
 * Convenience wrapper for backward compatibility
 */
export async function uploadSessionFile({ sessionId, file }: UploadSessionFileOptions): Promise<UploadFileResult> {
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${sessionId}/${timestamp}_${sanitizedFilename}`;
  
  return uploadToBucket('session-files', path, file);
}

/**
 * Get a signed URL for a session file (valid for specified duration, default 1 hour)
 * Convenience wrapper for backward compatibility
 */
export async function getSessionFileSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  return getSignedUrlFromBucket('session-files', path, expiresIn);
}

/**
 * Delete a session file from storage
 * Convenience wrapper for backward compatibility
 */
export async function deleteSessionFile(path: string): Promise<void> {
  return deleteFromBucket('session-files', path);
}

/**
 * Staff Files Storage Functions
 */

export interface UploadStaffFileOptions {
  staffId: string;
  file: File;
}

/**
 * Upload a file to the staff-files bucket
 * Path format: {staffId}/{timestamp}_{filename}
 * Convenience wrapper for backward compatibility
 */
export async function uploadStaffFile({ staffId, file }: UploadStaffFileOptions): Promise<UploadFileResult> {
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${staffId}/${timestamp}_${sanitizedFilename}`;
  
  return uploadToBucket('staff-files', path, file);
}

/**
 * Get a signed URL for a staff file (valid for specified duration, default 1 hour)
 * Convenience wrapper for backward compatibility
 */
export async function getStaffFileSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  return getSignedUrlFromBucket('staff-files', path, expiresIn);
}

/**
 * Delete a staff file from storage
 * Convenience wrapper for backward compatibility
 */
export async function deleteStaffFile(path: string): Promise<void> {
  return deleteFromBucket('staff-files', path);
}

