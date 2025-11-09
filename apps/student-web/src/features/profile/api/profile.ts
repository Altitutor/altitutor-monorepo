import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

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
  updateProfile: async (updates: StudentProfileUpdate): Promise<StudentRow> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get student ID first
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (studentError) throw studentError;
    if (!studentData) throw new Error('Student not found');

    const studentId = (studentData as Pick<StudentRow, 'id'>).id;

    // Use type assertion to work around TypeScript inference issues with Supabase
    const query = supabase.from('students') as any;
    const { data, error } = await query
      .update(updates)
      .eq('id', studentId)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Update failed');
    return data as StudentRow;
  }
};

