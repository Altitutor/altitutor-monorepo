import { getSupabaseClient } from '@/shared/lib/supabase/client/index';
import type { Tables } from '@altitutor/shared';

export const studentSubjectsApi = {
  /**
   * Get current student's subjects
   * Uses vstudent_subjects view which automatically filters by current_student_id()
   */
  async getMySubjects(): Promise<Tables<'subjects'>[]> {
    const supabase = getSupabaseClient();
    
    // Query vstudent_subjects view - it already filters by current_student_id()
    const { data, error } = await supabase
      .from('vstudent_subjects')
      .select('*')
      .order('curriculum', { ascending: true })
      .order('year_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Tables<'subjects'>[];
  },
};

