import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getSignedUrl as getStorageSignedUrl } from '@/shared/lib/supabase/storage';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Files API for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ files (they're referenced in views)
 * File uploads and management should go through API routes
 */
export const filesApi = {
  /**
   * Get a file by ID
   * Files are referenced in vtutor_subject_resources view
   */
  getFile: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get file:', error);
      throw error;
    }
    
    return data ?? null;
  },
  
  /**
   * Get file with signed URL for download/preview
   */
  getFileWithSignedUrl: async (id: string) => {
    const file = await filesApi.getFile(id);
    
    if (!file) {
      return null;
    }

    if (!file.storage_path) {
      return { file, signedUrl: null as string | null };
    }

    const signedUrl = await getStorageSignedUrl(file.storage_path);

    return {
      file,
      signedUrl,
    };
  },
};
