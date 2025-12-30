import { getSupabaseClient } from '@/shared/lib/supabase/client/index';
import type { Tables } from '@altitutor/shared';

export const studentSubjectsApi = {
  /**
   * Get current student's subjects
   */
  async getMySubjects(): Promise<Tables<'subjects'>[]> {
    const supabase = getSupabaseClient();
    
    // Get current student ID
    const { data: studentId, error: studentIdError } = await supabase.rpc('current_student_id');
    if (studentIdError || !studentId) {
      throw new Error('Failed to get student ID');
    }

    // Get student's subjects
    const { data, error } = await supabase
      .from('students_subjects')
      .select('subject_details:subjects(*)')
      .eq('student_id', studentId);

    if (error) {
      throw error;
    }

    return (data || [])
      .map((row: any) => row.subject_details)
      .filter(Boolean) as Tables<'subjects'>[];
  },
};

