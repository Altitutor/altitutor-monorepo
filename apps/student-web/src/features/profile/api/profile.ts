import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

// Lazy client creation to avoid issues during static generation
function getSupabaseClient() {
  return createClientComponentClient<Database>();
}

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type StudentUpdate = Database['public']['Tables']['students']['Update'];

export interface StudentProfileUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  school?: string;
  curriculum?: string;
  year_level?: number;
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
   * Get profile from vstudent_profile view
   */
  getProfile: async (): Promise<StudentProfile | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_profile')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update profile (via API route)
   */
  updateProfile: async (updates: StudentProfileUpdate): Promise<StudentRow> => {
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
    return result.data as StudentRow;
  }
};

