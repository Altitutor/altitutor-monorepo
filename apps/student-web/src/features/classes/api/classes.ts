import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

export const classesApi = {
  /**
   * List all classes for the current student
   */
  list: async () => {
    const { data, error } = await supabase
      .from('vstudent_classes')
      .select('*')
      .order('day_of_week', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Get single class details with participants
   */
  getDetails: async (classId: string) => {
    const { data, error } = await supabase
      .from('vstudent_class_detail')
      .select('*')
      .eq('class_id', classId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get sessions for a specific class
   */
  getSessions: async (classId: string) => {
    const { data, error } = await supabase
      .from('vstudent_sessions')
      .select('*')
      .eq('class_id', classId)
      .order('start_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};

