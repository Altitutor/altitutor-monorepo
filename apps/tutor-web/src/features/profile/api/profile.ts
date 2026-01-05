import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];
type StaffRow = Database['public']['Tables']['staff']['Row'];

export interface TutorProfileUpdate {
  phone_number?: string;
  // Availability fields (individual days)
  availability_monday?: boolean;
  availability_tuesday?: boolean;
  availability_wednesday?: boolean;
  availability_thursday?: boolean;
  availability_friday?: boolean;
  availability_saturday_am?: boolean;
  availability_saturday_pm?: boolean;
  availability_sunday_am?: boolean;
  availability_sunday_pm?: boolean;
}

export const profileApi = {
  /**
   * Get profile from vtutor_profile view
   * Pattern: Read through views (client-side), Write through API routes (server-side)
   */
  getProfile: async (): Promise<TutorProfile | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_profile')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update profile (via API route)
   */
  updateProfile: async (updates: TutorProfileUpdate): Promise<StaffRow> => {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const result = await response.json();
    return result.data as StaffRow;
  }
};

