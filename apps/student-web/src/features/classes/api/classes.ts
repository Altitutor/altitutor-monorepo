import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

type StudentClass = Database['public']['Views']['vstudent_classes']['Row'];
type StudentClassDetail = Database['public']['Views']['vstudent_class_detail']['Row'];

export const classesApi = {
  /**
   * List all classes for the current student
   */
  list: async (): Promise<StudentClass[]> => {
    const supabase = getSupabaseClient();
    
    // Verify we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[classesApi.list] Session error:', sessionError);
      throw new Error(`Session error: ${sessionError.message}`);
    }
    if (!session) {
      throw new Error('No active session. Please log in again.');
    }
    
    const { data, error } = await supabase
      .from('vstudent_classes')
      .select('*')
      .order('day_of_week', { ascending: true });
    
    if (error) {
      console.error('[classesApi.list] Error fetching classes:', error);
      console.error('[classesApi.list] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    
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

