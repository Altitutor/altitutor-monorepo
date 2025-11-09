import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ their own profile through vtutor_profile view
 * Profile updates must go through /api/profile API route
 * All other staff operations are not available to tutors
 */
export const staffApi = {
  /**
   * Get the current tutor's own profile
   * Uses vtutor_profile view
   */
  getCurrentProfile: async () => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_profile')
      .select('*')
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  },
};
