import { getSupabaseClient } from '@/shared/lib/supabase/client/index';
import type { Tables } from '@altitutor/shared';

export const studentSubjectsApi = {
  /**
   * Get subjects the current student intends to study in person.
   */
  async getMySubjects(): Promise<Tables<'subjects'>[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vstudent_in_person_subjects')
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
