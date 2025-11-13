import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

// Lazy client creation to avoid issues during static generation
function getSupabaseClient() {
  return createClientComponentClient<Database>();
}

type StudentClass = Database['public']['Views']['vstudent_classes']['Row'];
type StudentClassDetail = Database['public']['Views']['vstudent_class_detail']['Row'];

export const classesApi = {
  /**
   * List all classes for the current student
   */
  list: async (): Promise<StudentClass[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_classes')
      .select('*')
      .order('day_of_week', { ascending: true });
    
    if (error) throw error;
    return (data || []) as StudentClass[];
  },
  
  /**
   * Get single class details with participants
   */
  getDetails: async (classId: string): Promise<StudentClassDetail> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_class_detail')
      .select('*')
      .eq('class_id', classId)
      .single();
    
    if (error) throw error;
    return data as StudentClassDetail;
  },
  
  /**
   * Get sessions for a specific class
   */
  getSessions: async (classId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_sessions')
      .select('*')
      .eq('class_id', classId)
      .order('start_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};

