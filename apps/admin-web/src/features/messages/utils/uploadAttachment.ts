import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface UploadAttachmentResult {
  path: string;
  url: string;
}

/**
 * Upload a file to the messages-media bucket
 * Path format: {timestamp}_{filename}
 */
export async function uploadMessageAttachment(file: File): Promise<UploadAttachmentResult> {
  const supabase = getSupabaseClient();
  
  // Generate a unique filename to avoid collisions
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${timestamp}_${randomSuffix}_${sanitizedFilename}`;
  
  // Upload file to storage
  const { data, error } = await supabase.storage
    .from('messages-media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  // Get public URL (even though bucket is private, getPublicUrl returns the URL format)
  // The actual access will be controlled by RLS policies
  const { data: urlData } = supabase.storage
    .from('messages-media')
    .getPublicUrl(path);
  
  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}
