import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ their own profile through vtutor_profile view
 * Profile updates must go through /api/profile API route
 * Staff search for adding to sessions goes through /api/staff/search API route
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

  /**
   * Search for staff members (for adding to sessions)
   * Uses API route that handles authorization
   * Returns ACTIVE and TRIAL staff only
   */
  search: async (params: { search?: string; limit?: number }): Promise<{ staff: Tables<'staff'>[] }> => {
    const { search = '', limit = 20 } = params || {};
    const searchParams = new URLSearchParams();
    if (search) searchParams.set('search', search);
    searchParams.set('limit', limit.toString());
    
    const response = await fetch(`/api/staff/search?${searchParams.toString()}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to search staff' }));
      throw new Error(error.error || 'Failed to search staff');
    }
    
    return response.json();
  },
};
