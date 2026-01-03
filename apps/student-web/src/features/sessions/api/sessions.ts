import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';

type StudentSessionBase = Database['public']['Views']['vstudent_session_base']['Row'];

export interface StudentSessionWithStaff extends Omit<StudentSessionBase, 'staff' | 'students'> {
  staff: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role?: string;
    type?: string;
  }>;
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    year_level?: number;
  }>;
}

export const sessionsApi = {
  /**
   * List all sessions for the current student within a date range
   * Uses vstudent_session_base which includes staff as JSON
   */
  list: async (rangeStart: string, rangeEnd: string): Promise<StudentSessionWithStaff[]> => {
    const supabase = getSupabaseClient();
    
    // Convert date strings to UTC timestamps (interpret as local timezone)
    const utcStart = dateStringToUtcStart(rangeStart);
    const utcEnd = dateStringToUtcEnd(rangeEnd);
    
    const { data, error } = await supabase
      .from('vstudent_session_base')
      .select('*')
      .gte('start_at', utcStart)
      .lte('start_at', utcEnd)
      .order('start_at', { ascending: true });
    
    if (error) throw error;
    
    // Parse staff and students JSON
    return (data || []).map((session) => {
      const staff = (session.staff as any) || [];
      const students = (session.students as any) || [];
      return {
        ...session,
        staff: Array.isArray(staff) ? staff : [],
        students: Array.isArray(students) ? students : [],
      } as StudentSessionWithStaff;
    });
  },
};
