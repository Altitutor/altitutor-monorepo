import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

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
  getProfile: async () => {
    const { data, error } = await supabase
      .from('vstudent_profile')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update profile (direct write to students table)
   */
  updateProfile: async (updates: StudentProfileUpdate) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get student ID first
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!studentData) throw new Error('Student not found');

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentData.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

